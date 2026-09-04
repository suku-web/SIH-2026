"""
Speaker Verification
=====================
Answers: "Does this voice belong to the claimed person?"

Approach:
1. Enroll a person by extracting a voice embedding from a clean reference sample.
2. For a new (live) sample, extract its embedding.
3. Compare with cosine similarity -> match score (0-100%).

We use `resemblyzer`, a lightweight pretrained speaker-embedding model
(d-vector style). It needs no training data from you -- good for a hackathon
prototype. Swap in SpeechBrain's ECAPA-TDNN later for higher accuracy.
"""

import json
import os
from pathlib import Path

import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav

# Single shared encoder instance (loading it is the slow part, do it once)
_encoder = None


def get_encoder() -> VoiceEncoder:
    global _encoder
    if _encoder is None:
        _encoder = VoiceEncoder()
    return _encoder


def get_embedding(wav_path: str) -> np.ndarray:
    """Load an audio file and return its 256-d speaker embedding."""
    wav = preprocess_wav(Path(wav_path))
    return get_encoder().embed_utterance(wav)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


class VoiceEnrollmentStore:
    """
    Very simple JSON-backed store mapping identity -> embedding.
    Swap for MongoDB later (Member 6 owns the DB layer) -- this keeps
    Member 4's module runnable standalone for your own testing/demo.
    """

    def __init__(self, path: str = "enrollments.json"):
        self.path = path
        self._data = {}
        if os.path.exists(self.path):
            with open(self.path, "r") as f:
                raw = json.load(f)
            self._data = {k: np.array(v) for k, v in raw.items()}

    def enroll(self, identity: str, wav_path: str) -> None:
        emb = get_embedding(wav_path)
        self._data[identity] = emb
        self._save()

    def get(self, identity: str) -> np.ndarray | None:
        return self._data.get(identity)

    def _save(self):
        with open(self.path, "w") as f:
            json.dump({k: v.tolist() for k, v in self._data.items()}, f)


def verify_speaker(
    live_wav_path: str,
    claimed_identity: str,
    store: VoiceEnrollmentStore,
    match_threshold: float = 75.0,
) -> dict:
    """
    Returns:
        {
          "claimed_identity": str,
          "speaker_match_score": float (0-100),
          "identity_verified": bool,
          "reason": str  # only set if identity has no enrollment yet
        }
    """
    enrolled_emb = store.get(claimed_identity)
    if enrolled_emb is None:
        return {
            "claimed_identity": claimed_identity,
            "speaker_match_score": 0.0,
            "identity_verified": False,
            "reason": f"No enrolled voiceprint found for '{claimed_identity}'",
        }

    live_emb = get_embedding(live_wav_path)
    sim = cosine_similarity(enrolled_emb, live_emb)  # roughly -1..1, usually 0..1
    score = max(0.0, min(100.0, sim * 100))

    return {
        "claimed_identity": claimed_identity,
        "speaker_match_score": round(score, 1),
        "identity_verified": score >= match_threshold,
    }

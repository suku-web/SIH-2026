"""
Combined pipeline -- this is the single function Member 6 (or Member 5)
should call. It returns the exact JSON contract described in README.md.
"""

from conversation_analysis import analyze_conversation
from speaker_verification import VoiceEnrollmentStore, verify_speaker

_store = VoiceEnrollmentStore()


def enroll_voice(identity: str, wav_path: str) -> None:
    """One-time step: register a known-good voice sample for an identity."""
    _store.enroll(identity, wav_path)


def combined_analysis(live_wav_path: str, claimed_identity: str) -> dict:
    """
    Runs speaker verification + conversation risk analysis on one audio clip
    and returns the combined result Member 5's risk engine expects.
    """
    speaker_result = verify_speaker(live_wav_path, claimed_identity, _store)
    convo_result = analyze_conversation(live_wav_path)

    return {
        "claimed_identity": claimed_identity,
        "speaker_match_score": speaker_result["speaker_match_score"],
        "identity_verified": speaker_result["identity_verified"],
        "transcript": convo_result.transcript,
        "conversation_risk_score": convo_result.conversation_risk_score,
        "risk_flags": convo_result.risk_flags,
        "matched_phrases": convo_result.matched_phrases,
    }

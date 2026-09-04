"""
Conversation Analysis
======================
Answers: "Does what's being said sound like a social-engineering / fraud attempt?"

Pipeline:
  audio -> Whisper speech-to-text -> transcript
  transcript -> rule/pattern based risk scoring -> risk score + flags

The rule-based scorer below is deliberately transparent (easy to explain to
judges/mentor) and easy to extend. Swap for a fine-tuned text classifier later
if Member 3's dataset work produces labeled scam-call transcripts you can reuse.
"""

import re
from dataclasses import dataclass, field
from typing import List

from faster_whisper import WhisperModel

_model = None


def get_whisper_model(size: str = "small") -> WhisperModel:
    global _model
    if _model is None:
        # compute_type="int8" keeps it fast on CPU for a live demo
        _model = WhisperModel(size, device="cpu", compute_type="int8")
    return _model


def transcribe(wav_path: str) -> str:
    segments, _info = get_whisper_model().transcribe(wav_path, beam_size=5)
    return " ".join(seg.text.strip() for seg in segments).strip()


# --- Risk pattern definitions -------------------------------------------------
# Each category: (flag_name, weight, list of regex patterns)
RISK_CATEGORIES = [
    (
        "urgent_financial_request",
        35,
        [
            r"\btransfer\b.*\b(immediately|now|urgent(ly)?|asap)\b",
            r"\bsend\b.*\b(money|funds|rupees|lakh|crore|payment)\b",
            r"\b(wire|deposit)\b.*\b(account|funds)\b",
        ],
    ),
    (
    'financial_request',
    25,
    [
        r'\btransfer\b.*\b(rs\.?|rupees|₹)\s*[\d,]+',
        r'\bsend\b.*\b(rs\.?|rupees|₹)\s*[\d,]+',
        r'\b(payment|deposit|wire)\b.*\b(rs\.?|rupees|₹)\s*[\d,]+',
    ]
    ),
    (
        "otp_password_request",
        30,
        [
            r"\botp\b",
            r"\b(one[- ]time password)\b",
            r"\bpassword\b",
            r"\bpin\s*(code|number)?\b",
            r"\bcvv\b",
        ],
    ),
    (
        "secrecy_request",
        20,
        [
            r"\bdon'?t tell\b",
            r"\bkeep this (confidential|secret|between us)\b",
            r"\bdo not (inform|mention|tell)\b",
        ],
    ),
    (
        "authority_impersonation",
        20,
        [
            r"\bthis is (the )?(ceo|cfo|director|manager|police|bank)\b",
            r"\bi am (your|the) (boss|manager|supervisor)\b",
            r"\bofficial (order|instruction) from\b",
        ],
    ),
    (
        "bypass_procedure_request",
        25,
        [
            r"\bskip (the )?(verification|approval|process)\b",
            r"\bno need to (verify|check|confirm)\b",
            r"\bjust do it\b.*\b(quickly|now)\b",
        ],
    ),
    (
        "threat_or_pressure",
        20,
        [
            r"\bor else\b",
            r"\byou('ll| will) (be fired|lose your job|face consequences)\b",
            r"\blast (chance|warning)\b",
        ],
    ),
]


@dataclass
class ConversationRiskResult:
    transcript: str
    conversation_risk_score: float
    risk_flags: List[str] = field(default_factory=list)
    matched_phrases: dict = field(default_factory=dict)


def analyze_conversation_text(transcript: str) -> ConversationRiskResult:
    text = transcript.lower()
    flags = []
    matched = {}
    raw_score = 0

    for flag_name, weight, patterns in RISK_CATEGORIES:
        for pattern in patterns:
            m = re.search(pattern, text)
            if m:
                flags.append(flag_name)
                matched[flag_name] = m.group(0)
                raw_score += weight
                break  # only count each category once

    # Cap at 100, but let stacking multiple categories push risk up fast --
    # a call with 3+ red flags should look clearly dangerous.
    score = min(100.0, raw_score)

    return ConversationRiskResult(
        transcript=transcript,
        conversation_risk_score=round(score, 1),
        risk_flags=flags,
        matched_phrases=matched,
    )


def analyze_conversation(wav_path: str) -> ConversationRiskResult:
    transcript = transcribe(wav_path)
    return analyze_conversation_text(transcript)

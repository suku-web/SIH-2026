"""
Quick standalone demo of Member 4's module.

Usage:
    python demo.py enrolled_voice.wav live_call.wav "CFO"

- enrolled_voice.wav: a clean reference recording of the real person
- live_call.wav: the (possibly cloned/fraudulent) call to check
- "CFO": the identity being claimed on the call

This will:
  1. Enroll the reference voice under the given identity.
  2. Transcribe + analyze the live call for speaker match and risk phrases.
  3. Print a judge-friendly summary.
"""

import json
import sys

from pipeline import combined_analysis, enroll_voice


def main():
    if len(sys.argv) != 4:
        print('Usage: python demo.py <enrolled.wav> <live_call.wav> "<claimed_identity>"')
        sys.exit(1)

    enrolled_path, live_path, identity = sys.argv[1], sys.argv[2], sys.argv[3]

    print(f"Enrolling reference voice for '{identity}'...")
    enroll_voice(identity, enrolled_path)

    print("Analyzing live call...\n")
    result = combined_analysis(live_path, identity)

    print(json.dumps(result, indent=2))

    print("\n--- Summary ---")
    print(f"Claimed identity : {result['claimed_identity']}")
    print(f"Speaker match    : {result['speaker_match_score']}%  "
          f"({'VERIFIED' if result['identity_verified'] else 'MISMATCH'})")
    print(f"Conversation risk: {result['conversation_risk_score']}%")
    if result["risk_flags"]:
        print(f"Flags raised     : {', '.join(result['risk_flags'])}")
    else:
        print("Flags raised     : none")


if __name__ == "__main__":
    main()

# ============================================================
# MEMBER 5 - FULL INTEGRATION MODULE
# ============================================================

import sys
import os
import json
import tempfile
from pydub import AudioSegment


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

BLOCKCHAIN_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

FRONTEND_DIR = os.path.join(
    PROJECT_ROOT,
    "voice-security-frontend"
)

M3_DIR = os.path.join(
    PROJECT_ROOT,
    "m3_voice_clone_detection"
)


for folder in [
    PROJECT_ROOT,
    BLOCKCHAIN_DIR,
    FRONTEND_DIR,
    M3_DIR
]:
    if folder not in sys.path:
        sys.path.append(folder)


# ============================================================
# IMPORT PROJECT MODULES
# ============================================================

from pipeline import combined_analysis, enroll_voice
from m3_voice_clone_detection.test_model import predict_audio
from risk_engine import calculate_risk_from_analysis
from blockchain_audit import create_audit_record
from fraud_prevention import prevent_fraud
from audit_verifier import verify_audit_record


# ============================================================
# AUDIO CONVERSION
# ============================================================

def convert_to_wav(audio_path):
    """
    Converts WEBM/other supported audio into a temporary
    16kHz mono WAV file for Member 4 and Member 3.
    """

    audio_path = os.path.abspath(audio_path)

    print(
        f"\nConverting audio to WAV:\n{audio_path}"
    )

    audio = AudioSegment.from_file(audio_path)

    audio = (
        audio
        .set_frame_rate(16000)
        .set_channels(1)
        .set_sample_width(2)
    )

    temp_file = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False
    )

    temp_wav_path = temp_file.name
    temp_file.close()

    audio.export(
        temp_wav_path,
        format="wav"
    )

    return temp_wav_path


# ============================================================
# FULL PROCESSING PIPELINE
# ============================================================

def process_call(
    enrolled_audio_path,
    live_audio_path,
    claimed_identity
):

    enrolled_audio_path = os.path.abspath(
        enrolled_audio_path
    )

    live_audio_path = os.path.abspath(
        live_audio_path
    )

    temp_enrolled_wav = None
    temp_live_wav = None

    try:

        # ====================================================
        # STEP 1 - CONVERT ENROLLMENT AUDIO
        # ====================================================

        print("\n========================================")
        print("STEP 1: ENROLLMENT AUDIO CONVERSION")
        print("========================================")

        print(
            "Converting reference voice to WAV..."
        )

        temp_enrolled_wav = convert_to_wav(
            enrolled_audio_path
        )

        print(
            f"Reference WAV created: "
            f"{temp_enrolled_wav}"
        )


        # ====================================================
        # STEP 2 - CONVERT LIVE AUDIO
        # ====================================================

        print("\n========================================")
        print("STEP 2: LIVE AUDIO CONVERSION")
        print("========================================")

        print(
            "Converting live recording to WAV..."
        )

        temp_live_wav = convert_to_wav(
            live_audio_path
        )

        print(
            f"Live WAV created: "
            f"{temp_live_wav}"
        )


        # ====================================================
        # STEP 3 - VOICE ENROLLMENT
        # ====================================================

        print("\n========================================")
        print("STEP 3: VOICE ENROLLMENT")
        print("========================================")

        print(
            f"Enrolling reference voice for "
            f"'{claimed_identity}'..."
        )

        enroll_voice(
            claimed_identity,
            temp_enrolled_wav
        )

        print(
            "Reference voice enrolled successfully."
        )


        # ====================================================
        # STEP 4 - MEMBER 4 ANALYSIS
        # ====================================================

        print("\n========================================")
        print("STEP 4: MEMBER 4 ANALYSIS")
        print("========================================")

        print(
            "Analyzing live call..."
        )

        analysis_result = combined_analysis(
            temp_live_wav,
            claimed_identity
        )

        print("\nMember 4 Analysis:")

        print(
            json.dumps(
                analysis_result,
                indent=2
            )
        )


        # ====================================================
        # STEP 5 - MEMBER 3 CLONE DETECTION
        # ====================================================

        print("\n========================================")
        print("STEP 5: MEMBER 3 VOICE CLONE DETECTION")
        print("========================================")

        print(
            "Running AI voice clone detection..."
        )

        original_cwd = os.getcwd()

        try:

            os.chdir(M3_DIR)

            clone_result = predict_audio(
                temp_live_wav
            )

        finally:

            os.chdir(original_cwd)


        clone_probability = clone_result[
            "fake_probability"
        ]

        print("\nVoice Clone Detection Result:")

        print(
            json.dumps(
                clone_result,
                indent=2
            )
        )

        print(
            f"\nClone Probability: "
            f"{clone_probability}%"
        )


        # ====================================================
        # STEP 6 - RISK ENGINE
        # ====================================================

        print("\n========================================")
        print("STEP 6: RISK ENGINE")
        print("========================================")

        print(
            "Calculating final fraud risk..."
        )

        risk_result = calculate_risk_from_analysis(
            clone_probability,
            analysis_result
        )

        print("\nFinal Risk Result:")

        print(
            json.dumps(
                risk_result,
                indent=2
            )
        )


        # ====================================================
        # STEP 7 - FRAUD PREVENTION
        # ====================================================

        print("\n========================================")
        print("STEP 7: FRAUD PREVENTION")
        print("========================================")

        print(
            "Selecting fraud prevention action..."
        )

        prevention_result = prevent_fraud(
            risk_result
        )

        print("\nFraud Prevention Result:")

        print(
            json.dumps(
                prevention_result,
                indent=2
            )
        )


        # ====================================================
        # STEP 8 - BLOCKCHAIN / AUDIT
        # ====================================================

        print("\n========================================")
        print("STEP 8: BLOCKCHAIN / AUDIT")
        print("========================================")

        print(
            "Creating tamper-evident audit record..."
        )

        audit_record = create_audit_record(
            risk_result,
            claimed_identity
        )

        print("\nBlockchain / Audit Record:")

        print(
            json.dumps(
                audit_record,
                indent=2
            )
        )


        # ====================================================
        # STEP 9 - AUDIT VERIFICATION
        # ====================================================

        print("\n========================================")
        print("STEP 9: AUDIT VERIFICATION")
        print("========================================")

        print(
            "Verifying audit record integrity..."
        )

        verification_result = verify_audit_record(
            audit_record
        )

        print("\nAudit Verification Result:")

        print(
            json.dumps(
                verification_result,
                indent=2
            )
        )


        # ====================================================
        # STEP 10 - FINAL SYSTEM RESULT
        # ====================================================

        print("\n========================================")
        print("STEP 10: FINAL SYSTEM RESULT")
        print("========================================")

        final_result = {
            "claimed_identity": claimed_identity,

            "analysis": analysis_result,

            "voice_clone": clone_result,

            "risk": risk_result,

            "prevention": prevention_result,

            "audit": audit_record,

            "audit_verification":
                verification_result
        }

        print(
            json.dumps(
                final_result,
                indent=2
            )
        )

        return final_result


    except Exception as error:

        print("\n========================================")
        print("INTEGRATION ERROR")
        print("========================================")

        print(
            f"{type(error).__name__}: {error}"
        )

        raise


    finally:

        # ====================================================
        # CLEANUP
        # ====================================================

        for temp_file in [
            temp_enrolled_wav,
            temp_live_wav
        ]:

            if (
                temp_file
                and os.path.exists(temp_file)
            ):

                os.remove(temp_file)

                print(
                    f"\nTemporary WAV deleted: "
                    f"{temp_file}"
                )


# ============================================================
# COMMAND LINE TEST
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) != 4:

        print("\nUsage:")

        print(
            'python blockchain/integration.py '
            '<enrolled_audio> '
            '<live_audio> '
            '"<claimed_identity>"'
        )

        print("\nExample:")

        print(
            'python blockchain/integration.py '
            'enrolled.webm '
            'live.webm '
            '"CFO"'
        )

        sys.exit(1)


    enrolled_path = sys.argv[1]

    live_path = sys.argv[2]

    claimed_identity = sys.argv[3]


    if not os.path.exists(
        enrolled_path
    ):

        print(
            f"\nERROR: Enrolled audio file not found:\n"
            f"{enrolled_path}"
        )

        sys.exit(1)


    if not os.path.exists(
        live_path
    ):

        print(
            f"\nERROR: Live audio file not found:\n"
            f"{live_path}"
        )

        sys.exit(1)


    process_call(
        enrolled_audio_path=enrolled_path,
        live_audio_path=live_path,
        claimed_identity=claimed_identity
    )
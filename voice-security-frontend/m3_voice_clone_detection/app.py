from fastapi import FastAPI, UploadFile, File, HTTPException
import os
import tempfile
import uuid

from pydub import AudioSegment

from test_model import predict_audio


app = FastAPI(
    title="AI Voice Clone Detection API",
    description="Detects whether uploaded speech is REAL or AI-generated.",
    version="2.0"
)


# Supported input formats
SUPPORTED_FORMATS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".flac",
    ".ogg",
    ".aac",
    ".wma",
    ".webm"
}


@app.get("/")
def home():
    return {
        "message": "AI Voice Clone Detection API is running",
        "status": "OK"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # --------------------------------------------------
    # 1. Check file extension
    # --------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No filename provided."
        )

    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Supported formats: WAV, MP3, M4A, FLAC, OGG, "
                "AAC, WMA and WEBM."
            )
        )

    # --------------------------------------------------
    # 2. Create unique temporary filenames
    # --------------------------------------------------

    unique_id = uuid.uuid4().hex

    original_path = os.path.join(
        tempfile.gettempdir(),
        f"input_{unique_id}{extension}"
    )

    converted_path = os.path.join(
        tempfile.gettempdir(),
        f"converted_{unique_id}.wav"
    )

    try:

        # --------------------------------------------------
        # 3. Save uploaded file
        # --------------------------------------------------

        contents = await file.read()

        with open(original_path, "wb") as f:
            f.write(contents)

        # --------------------------------------------------
        # 4. Convert audio using FFmpeg/Pydub
        # --------------------------------------------------

        print(f"Received file: {file.filename}")
        print("Converting audio to 16 kHz mono WAV...")

        audio = AudioSegment.from_file(original_path)

        # Convert to mono
        audio = audio.set_channels(1)

        # Convert sample rate to 16 kHz
        audio = audio.set_frame_rate(16000)

        # Use 16-bit PCM
        audio = audio.set_sample_width(2)

        # Export as WAV
        audio.export(
            converted_path,
            format="wav"
        )

        print("Conversion completed.")

        # --------------------------------------------------
        # 5. Run CNN prediction
        # --------------------------------------------------

        print("Running voice clone detection...")

        result = predict_audio(converted_path)

        print("Prediction completed.")
        print(f"Result: {result['result']}")

        # --------------------------------------------------
        # 6. Return prediction
        # --------------------------------------------------

        return {
            "filename": file.filename,
            "input_format": extension.replace(".", "").upper(),
            "processed_format": "WAV",
            "sample_rate": 16000,
            "channels": 1,

            "result": result["result"],

            "real_probability": result["real_probability"],
            "fake_probability": result["fake_probability"],

            "segments_analyzed": result["segments_analyzed"],
            "real_segments": result.get("real_segments", 0),
            "fake_segments": result.get("fake_segments", 0),

            "duration_seconds": result["duration_seconds"],

            "validation_accuracy": result.get(
                "validation_accuracy",
                None
            )
        }

    except Exception as e:

        print(f"ERROR: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=f"Audio processing failed: {str(e)}"
        )

    finally:

        # --------------------------------------------------
        # 7. Delete temporary files
        # --------------------------------------------------

        if os.path.exists(original_path):
            os.remove(original_path)

        if os.path.exists(converted_path):
            os.remove(converted_path)
"""
FastAPI wrapper for Member 4's module.

Run with:
    uvicorn app.api:app --reload --port 8004

Endpoints:
    POST /enroll          -- register a reference voice sample for an identity
    POST /analyze         -- run speaker verification + conversation risk analysis

Member 6 (dashboard/backend integration) calls /analyze and forwards the
result to Member 5's risk engine.
"""

import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile

from pipeline import combined_analysis, enroll_voice

app = FastAPI(title="Member 4 - Speaker & Conversation Analysis")

@app.get("/")
def root():
    return {"service": "VoiceShield Speaker & Conversation Analysis API", "status": "running"}


def _save_upload(upload: UploadFile) -> str:
    suffix = Path(upload.filename).suffix or ".wav"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    with tmp as f:
        shutil.copyfileobj(upload.file, f)
    return tmp.name


@app.post("/enroll")
async def enroll(identity: str = Form(...), file: UploadFile = File(...)):
    wav_path = _save_upload(file)
    enroll_voice(identity, wav_path)
    return {"status": "enrolled", "identity": identity}


@app.post("/analyze")
async def analyze(claimed_identity: str = Form(...), file: UploadFile = File(...)):
    wav_path = _save_upload(file)
    result = combined_analysis(wav_path, claimed_identity)
    return result


@app.get("/health")
async def health():
    return {"status": "ok"}


# VoiceGuard frontend integration

This bundle is structured to drop into the `suku-web/SIH-2026` Vite/React repo.

## Files

- `src/App.jsx`
- `src/App.css`
- `src/index.css`
- `src/components/VoiceRecorder.jsx`
- `src/lib/api.js`
- `.env.example`
- `BACKEND_CORS_PATCH.md`

The UI uses the real FastAPI contract in the repository:

- `GET /health`
- `POST /enroll` with `identity` + `file`
- `POST /analyze` with `claimed_identity` + `file`

No demo transcript, fake risk score, fake speaker score, or fabricated backend status is used.

## Important audio fix

The browser first captures audio with `MediaRecorder`, then converts it to PCM WAV in the browser before upload. The repository backend saves the upload using the filename suffix, and the Python ML stack is designed around normal audio/WAV input. This avoids depending on the backend being able to decode browser-specific WebM/OGG containers.

## One backend change required for local browser requests

The current `api.py` in the GitHub repo has no CORS middleware. Apply the exact patch in `BACKEND_CORS_PATCH.md`.

## Run

Backend:
```bash
pip install -r requirements.txt
uvicorn api:app --reload --port 8004
```

Frontend:
```bash
npm install
npm run dev
```

Set `.env`:
```env
VITE_API_BASE_URL=http://localhost:8004
```

Then open the Vite URL, normally `http://localhost:5173`.

## Real workflow

1. Enter an identity such as `CFO`.
2. Record a real reference sample and click `ENROLL VOICE`.
3. Record the live call and click `ANALYZE CALL`.
4. The dashboard displays the JSON returned by `/analyze`.
5. The transcript, speaker score, identity verification, conversation risk, flags, and matched phrases all come directly from the backend response.

The repo currently returns no voice-clone, blockchain/audit, fraud-action, or separate risk-engine decision fields from `/analyze`, so those are intentionally not fabricated in this frontend.

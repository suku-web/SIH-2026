# Backend CORS patch

The current `api.py` does not enable browser CORS. Add this import:

```python
from fastapi.middleware.cors import CORSMiddleware
```

Immediately after:

```python
app = FastAPI(title="Member 4 - Speaker & Conversation Analysis")
```

add:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

Do not change the existing `/enroll`, `/analyze`, or `/health` routes.

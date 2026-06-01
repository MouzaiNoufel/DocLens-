"""App configuration. Reads from environment variables, falls back to defaults.

SQLite is the default for zero-setup local dev; switch to Postgres for
production by setting DATABASE_URL in .env or the environment.

DEMO_MODE bypasses the VLM and returns realistic mock extractions, so the app
can run end-to-end on cheap CPU-only cloud hosts (Railway, Fly.io, Render).
"""

from __future__ import annotations

import os
from pathlib import Path


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in ("true", "1", "yes", "on")


DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "sqlite+aiosqlite:///./doclens.db"
)
UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", "./uploads"))
AUTO_APPROVE_THRESHOLD: float = float(os.getenv("AUTO_APPROVE_THRESHOLD", "0.85"))
MODEL_NAME: str = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-VL-3B-Instruct")
MAX_PIXELS: int = int(os.getenv("MAX_PIXELS", str(1280 * 1280)))

# Demo mode: return mock extractions instead of running the VLM.
# Used for cloud demos where a GPU isn't available.
DEMO_MODE: bool = _bool("DOCLENS_DEMO_MODE", default=False)

# Comma-separated list of allowed origins for the dashboard.
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174",
    ).split(",") if o.strip()
]

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

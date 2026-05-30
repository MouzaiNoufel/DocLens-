"""App configuration. Reads from environment variables, falls back to defaults.

SQLite is the default for zero-setup local dev; switch to Postgres for
production by setting DATABASE_URL in .env or the environment.
"""

from __future__ import annotations

import os
from pathlib import Path

DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "sqlite+aiosqlite:///./doclens.db"
)
UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", "./uploads"))
AUTO_APPROVE_THRESHOLD: float = float(os.getenv("AUTO_APPROVE_THRESHOLD", "0.85"))
MODEL_NAME: str = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-VL-3B-Instruct")
MAX_PIXELS: int = int(os.getenv("MAX_PIXELS", str(1280 * 1280)))

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

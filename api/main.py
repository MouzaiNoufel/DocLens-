"""DocLens API.

Start with:  uvicorn api.main:app --reload
Docs at:     http://localhost:8000/docs
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import init_db
from .routes import analytics, documents, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="DocLens API",
    version="0.1.0",
    description="Intelligent document processing for invoices",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(stats.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "doclens"}

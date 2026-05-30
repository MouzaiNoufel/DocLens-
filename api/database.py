"""Async SQLAlchemy setup.

Uses aiosqlite for local dev (default) or asyncpg for Postgres in production.
Tables are created at app startup via init_db(); add Alembic later for
migration management if the schema evolves.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency: yields an async session, auto-closes after the request."""
    async with async_session() as session:
        yield session


async def init_db():
    """Create all tables if they don't exist yet."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

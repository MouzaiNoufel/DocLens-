"""Stats endpoint — feeds the dashboard summary cards."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Document
from ..schemas import StatsOut

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Document.status, func.count(Document.id)).group_by(Document.status)
    )
    counts = dict(result.all())
    return StatsOut(
        total=sum(counts.values()),
        processing=counts.get("processing", 0),
        auto_approved=counts.get("auto_approved", 0),
        needs_review=counts.get("needs_review", 0),
        reviewed=counts.get("reviewed", 0),
    )

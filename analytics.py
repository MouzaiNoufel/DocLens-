"""Analytics endpoint.

Single comprehensive call that powers the dashboard's analytics view:
- Summary KPIs (counts, rates, avg confidence)
- Throughput (docs/day, last 14 days)
- Confidence distribution (5 buckets)
- Per-field accuracy (% uncorrected)
- Top flags (most common validation flags)
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Document, ExtractionField
from ..schemas import (
    AnalyticsResponse,
    AnalyticsSummary,
    ConfidenceBucket,
    FieldAccuracy,
    FlagCount,
    ThroughputPoint,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("", response_model=AnalyticsResponse)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    # ── 1. Status counts ──
    status_result = await db.execute(
        select(Document.status, func.count(Document.id)).group_by(Document.status)
    )
    status_counts = dict(status_result.all())

    total = sum(status_counts.values())
    auto_approved = status_counts.get("auto_approved", 0)
    needs_review = status_counts.get("needs_review", 0)
    reviewed = status_counts.get("reviewed", 0)
    processing = status_counts.get("processing", 0)

    # ── 2. Avg confidence (excluding processing) ──
    avg_result = await db.execute(
        select(func.avg(Document.overall_confidence)).where(
            Document.status != "processing"
        )
    )
    avg_confidence = float(avg_result.scalar() or 0.0)

    # ── 3. Auto-approve rate (of decided documents) ──
    decided = total - processing
    auto_approve_rate = (auto_approved / decided) if decided > 0 else 0.0

    # ── 4. Correction rate (% of documents with ≥ 1 corrected field) ──
    corrected_docs_result = await db.execute(
        select(func.count(func.distinct(ExtractionField.document_id))).where(
            ExtractionField.corrected_value.isnot(None)
        )
    )
    corrected_docs = corrected_docs_result.scalar() or 0
    correction_rate = (corrected_docs / total) if total > 0 else 0.0

    summary = AnalyticsSummary(
        total_documents=total,
        auto_approved=auto_approved,
        needs_review=needs_review,
        reviewed=reviewed,
        processing=processing,
        auto_approve_rate=round(auto_approve_rate, 3),
        correction_rate=round(correction_rate, 3),
        avg_confidence=round(avg_confidence, 3),
    )

    # ── 5. Throughput: docs per day, last 14 days ──
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    throughput_result = await db.execute(
        select(
            func.date(Document.created_at).label("day"),
            func.count(Document.id).label("count"),
        )
        .where(Document.created_at >= cutoff)
        .group_by("day")
        .order_by("day")
    )
    throughput = [
        ThroughputPoint(date=str(row.day), count=row.count)
        for row in throughput_result.all()
    ]

    # ── 6. Confidence distribution ──
    buckets = [
        ("0-20%", 0.0, 0.2),
        ("20-40%", 0.2, 0.4),
        ("40-60%", 0.4, 0.6),
        ("60-80%", 0.6, 0.8),
        ("80-100%", 0.8, 1.01),
    ]
    confidence_distribution = []
    for label, lo, hi in buckets:
        bucket_result = await db.execute(
            select(func.count(Document.id))
            .where(Document.overall_confidence >= lo)
            .where(Document.overall_confidence < hi)
            .where(Document.status != "processing")
        )
        confidence_distribution.append(
            ConfidenceBucket(bucket=label, count=bucket_result.scalar() or 0)
        )

    # ── 7. Field accuracy (% uncorrected, per field) ──
    field_result = await db.execute(
        select(
            ExtractionField.field_name,
            func.count(ExtractionField.id).label("total"),
            func.sum(
                case((ExtractionField.corrected_value.isnot(None), 1), else_=0)
            ).label("corrected"),
        ).group_by(ExtractionField.field_name)
    )
    field_accuracy = []
    for row in field_result.all():
        total_f = row.total or 0
        corrected_f = row.corrected or 0
        accuracy = 1 - (corrected_f / total_f) if total_f > 0 else 1.0
        field_accuracy.append(
            FieldAccuracy(
                field_name=row.field_name,
                total=total_f,
                corrected=corrected_f,
                accuracy=round(accuracy, 3),
            )
        )
    # sort by accuracy ascending (worst first — most useful to see)
    field_accuracy.sort(key=lambda f: f.accuracy)

    # ── 8. Top flags ──
    flags_result = await db.execute(select(Document.flags))
    flag_counter: Counter[str] = Counter()
    for row in flags_result.all():
        flags = row[0] or []
        if flags:
            flag_counter.update(flags)
    top_flags = [
        FlagCount(flag=flag, count=count)
        for flag, count in flag_counter.most_common(10)
    ]

    return AnalyticsResponse(
        summary=summary,
        throughput=throughput,
        confidence_distribution=confidence_distribution,
        field_accuracy=field_accuracy,
        top_flags=top_flags,
    )

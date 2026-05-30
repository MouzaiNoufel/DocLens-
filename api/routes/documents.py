"""Document endpoints.

POST /upload    — upload an invoice, kick off background extraction
GET  /          — list documents (filterable by status)
GET  /{id}      — full document detail with fields + line items
PATCH /{id}/fields/{name} — correct a field (reviewer workflow)
POST /{id}/approve — mark as reviewed
POST /{id}/reject  — send back to review
"""

from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import UPLOAD_DIR
from ..database import get_db
from ..models import Document, ExtractionField
from ..schemas import (
    DocumentDetail,
    DocumentListItem,
    FieldOut,
    FieldUpdate,
    LineItemOut,
)
from ..tasks import run_extraction

router = APIRouter(prefix="/api/documents", tags=["documents"])

_ALLOWED_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"}


@router.post("/upload", status_code=201)
async def upload_document(
    bg: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}{suffix}"
    file_path = UPLOAD_DIR / safe_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    doc = Document(
        id=doc_id,
        filename=safe_name,
        original_filename=file.filename,
        file_path=str(file_path),
        status="processing",
    )
    db.add(doc)
    await db.commit()

    bg.add_task(run_extraction, doc_id, str(file_path))

    return {"id": doc_id, "status": "processing", "filename": file.filename}


@router.get("", response_model=list[DocumentListItem])
async def list_documents(
    status: str | None = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Document).options(selectinload(Document.fields))
    if status:
        query = query.where(Document.status == status)
    query = query.order_by(Document.created_at.desc())

    result = await db.execute(query)
    docs = result.scalars().all()

    out: list[DocumentListItem] = []
    for doc in docs:
        fields_map = {
            f.field_name: (f.corrected_value or f.extracted_value)
            for f in doc.fields
        }
        total_str = fields_map.get("total")
        out.append(
            DocumentListItem(
                id=doc.id,
                filename=doc.original_filename,
                status=doc.status,
                overall_confidence=doc.overall_confidence,
                flags=doc.flags or [],
                vendor_name=fields_map.get("vendor_name"),
                invoice_number=fields_map.get("invoice_number"),
                total=float(total_str) if total_str else None,
                created_at=doc.created_at,
            )
        )
    return out


@router.get("/{doc_id}", response_model=DocumentDetail)
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(Document)
        .options(selectinload(Document.fields), selectinload(Document.line_items))
        .where(Document.id == doc_id)
    )
    result = await db.execute(query)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    return DocumentDetail(
        id=doc.id,
        filename=doc.original_filename,
        status=doc.status,
        overall_confidence=doc.overall_confidence,
        flags=doc.flags or [],
        page_count=doc.page_count,
        fields=[
            FieldOut(
                field_name=f.field_name,
                value=f.corrected_value or f.extracted_value,
                confidence=f.confidence,
                corrected_value=f.corrected_value,
                corrected_at=f.corrected_at,
            )
            for f in doc.fields
        ],
        line_items=[
            LineItemOut(
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                amount=li.amount,
            )
            for li in doc.line_items
        ],
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.patch("/{doc_id}/fields/{field_name}")
async def update_field(
    doc_id: str,
    field_name: str,
    body: FieldUpdate,
    db: AsyncSession = Depends(get_db),
):
    query = select(ExtractionField).where(
        ExtractionField.document_id == doc_id,
        ExtractionField.field_name == field_name,
    )
    result = await db.execute(query)
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(404, f"Field '{field_name}' not found on document {doc_id}")

    field.corrected_value = body.value
    field.corrected_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "updated", "field": field_name, "new_value": body.value}


@router.post("/{doc_id}/approve")
async def approve_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status not in ("needs_review", "processing"):
        raise HTTPException(400, f"Cannot approve a document with status '{doc.status}'")

    doc.status = "reviewed"
    doc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "reviewed", "id": doc_id}


@router.post("/{doc_id}/reject")
async def reject_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.status = "needs_review"
    doc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "needs_review", "id": doc_id}

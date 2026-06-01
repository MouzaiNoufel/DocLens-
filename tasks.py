"""Background extraction task.

The VLM model is loaded lazily on the first request and cached for all
subsequent extractions (it stays in GPU memory). The heavy, GPU-bound
inference runs in a threadpool via asyncio.to_thread so it doesn't block
the FastAPI event loop.

For production with multiple workers, replace BackgroundTasks with Celery
and load the model once per worker process.
"""

from __future__ import annotations

import asyncio
import logging

from .config import AUTO_APPROVE_THRESHOLD, DEMO_MODE, MAX_PIXELS, MODEL_NAME
from .database import async_session
from .models import Document, ExtractionField, LineItem

logger = logging.getLogger("doclens.tasks")

_extractor = None


def _get_extractor():
    global _extractor
    if _extractor is None:
        from invoice_idp.extractor import InvoiceExtractor

        logger.info("Loading VLM model (first request — takes 30-60s) ...")
        _extractor = InvoiceExtractor(
            model_name=MODEL_NAME, max_pixels=MAX_PIXELS
        )
        logger.info("Model loaded and cached.")
    return _extractor


def _demo_pipeline(file_path: str):
    """Return a realistic mock extraction without loading the VLM.

    Used in DEMO_MODE for cloud demos where no GPU is available. The mock
    output varies per call (different vendors, totals, occasional flags) so
    the analytics view has real-looking data to display.
    """
    import random
    import time

    from invoice_idp.preprocess import load_as_images
    from invoice_idp.schema import InvoiceFields, LineItem
    from invoice_idp.validate import validate_and_route

    images = load_as_images(file_path)
    time.sleep(1.5 + random.random() * 2)  # simulate processing latency

    vendors = [
        ("Acme Supplies Ltd", "742 Industrial Blvd, Chicago IL"),
        ("TechCorp Inc", "1200 Tech Park Dr, Austin TX"),
        ("Global Logistics Co", "88 Harbor Way, Long Beach CA"),
        ("Pinnacle Tech Solutions", "2800 Innovation Drive, San Francisco CA"),
        ("Smith & Partners LLP", "55 Court St, Boston MA"),
        ("Metro Office Supply", "320 Commerce Rd, Newark NJ"),
    ]
    vendor_name, vendor_addr = random.choice(vendors)

    subtotal = round(random.uniform(200, 12000), 2)
    tax = round(subtotal * random.uniform(0.05, 0.10), 2)
    total = round(subtotal + tax, 2)

    # ~12% of mock invoices have a totals mismatch — makes flags chart non-empty
    flags: list[str] = []
    if random.random() < 0.12:
        total = round(total + random.uniform(1, 8), 2)

    line_unit = round(subtotal / 2, 2)
    fields = InvoiceFields(
        vendor_name=vendor_name,
        vendor_address=vendor_addr,
        invoice_number=f"INV-2024-{random.randint(1000, 9999)}",
        invoice_date=f"2024-03-{random.randint(10, 28):02d}",
        due_date=f"2024-04-{random.randint(10, 28):02d}",
        currency="USD",
        line_items=[
            LineItem(description="Professional services", quantity=random.randint(1, 10),
                     unit_price=line_unit, amount=line_unit),
            LineItem(description="Setup & onboarding", quantity=1,
                     unit_price=line_unit, amount=line_unit),
        ],
        subtotal=subtotal,
        tax=tax,
        total=total,
    )

    field_confidence = {
        "vendor_name": random.uniform(0.80, 0.99),
        "vendor_address": random.uniform(0.70, 0.95),
        "invoice_number": random.uniform(0.90, 0.99),
        "invoice_date": random.uniform(0.80, 0.95),
        "due_date": random.uniform(0.75, 0.95),
        "currency": random.uniform(0.95, 0.99),
        "subtotal": random.uniform(0.80, 0.98),
        "tax": random.uniform(0.75, 0.95),
        "total": random.uniform(0.70, 0.99),
    }

    result = validate_and_route(
        fields, field_confidence, flags, auto_approve_threshold=AUTO_APPROVE_THRESHOLD
    )
    return result, len(images)


def _sync_pipeline(file_path: str):
    """Run preprocess → extract → validate synchronously (CPU/GPU-bound)."""
    if DEMO_MODE:
        logger.info("DEMO_MODE: returning mock extraction (no VLM)")
        return _demo_pipeline(file_path)

    from invoice_idp.preprocess import load_as_images
    from invoice_idp.validate import validate_and_route

    images = load_as_images(file_path)
    extractor = _get_extractor()
    fields, confidence, flags = extractor.extract(images)
    result = validate_and_route(
        fields, confidence, flags, auto_approve_threshold=AUTO_APPROVE_THRESHOLD
    )
    return result, len(images)


async def run_extraction(document_id: str, file_path: str) -> None:
    """Full extraction pipeline: runs sync inference in a thread, then saves to DB."""
    try:
        result, page_count = await asyncio.to_thread(_sync_pipeline, file_path)

        async with async_session() as session:
            doc = await session.get(Document, document_id)
            if doc is None:
                logger.error("Document %s vanished before results could be saved", document_id)
                return

            doc.status = result.routing
            doc.overall_confidence = result.overall_confidence
            doc.flags = result.flags
            doc.page_count = page_count

            for field_name, field_val in result.fields.model_dump().items():
                if field_name == "line_items":
                    continue
                session.add(
                    ExtractionField(
                        document_id=document_id,
                        field_name=field_name,
                        extracted_value=str(field_val) if field_val is not None else None,
                        confidence=result.field_confidence.get(field_name, 0.5),
                    )
                )

            for li in result.fields.line_items:
                session.add(
                    LineItem(
                        document_id=document_id,
                        description=li.description,
                        quantity=li.quantity,
                        unit_price=li.unit_price,
                        amount=li.amount,
                    )
                )

            await session.commit()
            logger.info(
                "Document %s → %s (confidence=%.2f, flags=%s)",
                document_id, result.routing, result.overall_confidence, result.flags,
            )

    except Exception:
        logger.exception("Extraction failed for document %s", document_id)
        async with async_session() as session:
            doc = await session.get(Document, document_id)
            if doc:
                doc.status = "needs_review"
                doc.flags = ["extraction_error"]
                await session.commit()

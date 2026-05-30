"""Validation + confidence routing.

Applies hard business rules (required fields, date parsing, totals
reconciliation) on top of the model's self-reported confidence, then decides
whether the extraction can be auto-approved or must go to the human review
queue. This rule-driven confidence is what makes routing trustworthy.
"""

from __future__ import annotations

from typing import List, Dict

from dateutil import parser as dateparser

from .schema import ExtractionResult, InvoiceFields

REQUIRED_FIELDS = ("vendor_name", "invoice_number", "invoice_date", "total")
AMOUNT_TOLERANCE = 0.02  # currency rounding tolerance
CRITICAL_FLAGS = ("json_parse_failed", "schema_validation_failed", "totals_mismatch")


def validate_and_route(
    fields: InvoiceFields,
    field_confidence: Dict[str, float],
    flags: List[str],
    auto_approve_threshold: float = 0.85,
) -> ExtractionResult:
    flags = list(flags)
    conf = dict(field_confidence)

    # 1. Required fields present?
    for field in REQUIRED_FIELDS:
        if getattr(fields, field) in (None, "", []):
            flags.append(f"missing_{field}")
            conf[field] = 0.0

    # 2. Normalize / validate dates.
    for date_field in ("invoice_date", "due_date"):
        value = getattr(fields, date_field)
        if value:
            normalized = _normalize_date(value)
            if normalized is None:
                flags.append(f"unparseable_{date_field}")
                conf[date_field] = min(conf.get(date_field, 0.5), 0.3)
            else:
                setattr(fields, date_field, normalized)

    # 3. Totals reconcile: subtotal + tax ~= total.
    if None not in (fields.subtotal, fields.tax, fields.total):
        if abs((fields.subtotal + fields.tax) - fields.total) > AMOUNT_TOLERANCE:
            flags.append("totals_mismatch")
            for field in ("subtotal", "tax", "total"):
                conf[field] = min(conf.get(field, 0.5), 0.4)

    # 4. Line items sum ~= subtotal (fallback: total).
    line_sum = sum(li.amount for li in fields.line_items if li.amount is not None)
    target = fields.subtotal if fields.subtotal is not None else fields.total
    if fields.line_items and target is not None and line_sum > 0:
        if abs(line_sum - target) > AMOUNT_TOLERANCE:
            flags.append("line_items_sum_mismatch")

    # 5. Overall confidence = weakest required field, penalized by critical flags.
    required_conf = [conf.get(field, 0.5) for field in REQUIRED_FIELDS]
    overall = min(required_conf) if required_conf else 0.0
    if _has_critical(flags):
        overall = min(overall, 0.4)

    routing = (
        "auto_approved"
        if overall >= auto_approve_threshold and not _has_critical(flags)
        else "needs_review"
    )

    return ExtractionResult(
        fields=fields,
        field_confidence=conf,
        overall_confidence=round(overall, 3),
        flags=flags,
        routing=routing,
    )


def _has_critical(flags: List[str]) -> bool:
    return any(f in CRITICAL_FLAGS or f.startswith("missing_") for f in flags)


def _normalize_date(value):
    try:
        return dateparser.parse(str(value), fuzzy=True).strftime("%Y-%m-%d")
    except (ValueError, OverflowError, TypeError):
        return None

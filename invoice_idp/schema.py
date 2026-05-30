"""Data models for invoice extraction.

`InvoiceFields` is the clean extracted data. `ExtractionResult` wraps it with
the confidence / routing metadata that drives the human-in-the-loop step.
"""

from __future__ import annotations

from typing import List, Optional, Dict, Literal

from pydantic import BaseModel, Field


class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None


class InvoiceFields(BaseModel):
    """The structured data we pull off an invoice."""

    vendor_name: Optional[str] = None
    vendor_address: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None      # ISO 8601 (YYYY-MM-DD) after validation
    due_date: Optional[str] = None          # ISO 8601 (YYYY-MM-DD) after validation
    currency: Optional[str] = None          # ISO 4217, e.g. "USD"
    line_items: List[LineItem] = Field(default_factory=list)
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None


Routing = Literal["auto_approved", "needs_review"]


class ExtractionResult(BaseModel):
    """Extracted fields + the metadata that decides auto-approve vs. review."""

    fields: InvoiceFields
    field_confidence: Dict[str, float] = Field(default_factory=dict)
    overall_confidence: float = 0.0
    flags: List[str] = Field(default_factory=list)
    routing: Routing = "needs_review"
    source_file: Optional[str] = None
    page_count: int = 0

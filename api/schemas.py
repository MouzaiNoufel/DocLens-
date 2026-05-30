"""API request / response models.

These are the shapes the dashboard (or any client) sees. They're intentionally
separate from invoice_idp.schema — the extraction models are internal; these
are the contract with the outside world.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class FieldOut(BaseModel):
    field_name: str
    value: Optional[str] = None
    confidence: float = 0.0
    corrected_value: Optional[str] = None
    corrected_at: Optional[datetime] = None


class LineItemOut(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None


class DocumentListItem(BaseModel):
    id: str
    filename: str
    status: str
    overall_confidence: float
    flags: list = []
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    total: Optional[float] = None
    created_at: datetime


class DocumentDetail(BaseModel):
    id: str
    filename: str
    status: str
    overall_confidence: float
    flags: list = []
    page_count: int = 0
    fields: List[FieldOut] = []
    line_items: List[LineItemOut] = []
    created_at: datetime
    updated_at: datetime


class FieldUpdate(BaseModel):
    value: str


class StatsOut(BaseModel):
    total: int = 0
    processing: int = 0
    auto_approved: int = 0
    needs_review: int = 0
    reviewed: int = 0

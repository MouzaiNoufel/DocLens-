# DocLens — Copilot Instructions

## Project overview

DocLens is an intelligent document processing (IDP) SaaS platform for invoices.
It ingests PDF or image invoices, extracts structured fields with a
vision-language model, validates them against business rules, and routes each
document to **auto-approve** or a **human review queue** based on per-field
confidence scores. Reviewer corrections feed back into an active-learning loop
that improves extraction over time.

This is a portfolio-grade, production-style project — treat it as a real SaaS
product, not a notebook or prototype.

## Architecture (pipeline)

```
Upload (PDF/image)
  → Preprocess (rasterize PDF pages via PyMuPDF, normalize to RGB PIL images)
  → Extraction engine (Qwen2.5-VL-3B-Instruct, 4-bit quantized, structured JSON output)
  → Validation & routing (business rules + confidence scoring → auto_approve | needs_review)
  → Human-in-the-loop review (dashboard: correct fields, approve)
  → Structured output (JSON / CSV / webhook)
  → Active learning (corrections retrain/fine-tune the extractor)
```

## Tech stack

- **Language**: Python 3.10+, strict type hints everywhere
- **VLM**: Qwen2.5-VL-3B-Instruct via HuggingFace transformers, 4-bit quantized
  with bitsandbytes (NF4, double quant, fp16 compute). Target GPU: RTX 3070 Ti (8GB).
- **PDF processing**: PyMuPDF (`fitz`) for rasterization — no poppler dependency
- **Schema / validation**: Pydantic v2 (BaseModel, model_validate, model_dump)
- **Date parsing**: python-dateutil
- **API (Phase 3)**: FastAPI + Uvicorn
- **Queue (Phase 3)**: Celery + Redis
- **Database (Phase 3)**: PostgreSQL via SQLAlchemy 2.0 (async)
- **Frontend (Phase 4)**: React + Tailwind CSS
- **Containerization**: Docker + Docker Compose

## Codebase structure

```
doclens/
├── run.py                        # CLI entry point
├── requirements.txt
├── README.md
├── .github/
│   └── copilot-instructions.md   # (this file)
├── invoice_idp/
│   ├── __init__.py
│   ├── schema.py                 # Pydantic models: InvoiceFields, ExtractionResult
│   ├── preprocess.py             # PDF/image → list of PIL images
│   ├── extractor.py              # VLM loading, prompting, JSON parsing
│   └── validate.py               # Business rules, confidence adjustment, routing
├── api/                          # (Phase 3 — FastAPI service layer)
│   ├── main.py
│   ├── routes/
│   ├── models/                   # SQLAlchemy ORM models
│   └── tasks/                    # Celery async tasks
├── dashboard/                    # (Phase 4 — React frontend)
├── tests/
└── docker-compose.yml
```

## Key design decisions

1. **Confidence-based routing** is the core differentiator. Every field gets a
   confidence score (0–1). The validator sharpens confidence with hard rules
   (totals reconcile, dates parse, required fields present) and routes the
   document. This is more trustworthy than model self-report alone.

2. **8GB VRAM constraint**: the VLM runs in 4-bit with capped max_pixels
   (default 1280×1280). Code must never assume unlimited GPU memory. Always
   provide a `--max-pixels` escape hatch and test with lower resolutions.

3. **Lazy heavy imports**: torch, transformers, bitsandbytes, and qwen_vl_utils
   are imported inside the class/function that uses them, not at module top
   level. This keeps CLI startup fast and avoids import errors when only running
   validation or schema code.

4. **Pydantic v2 throughout**: use `BaseModel`, `model_validate()`,
   `model_dump()`, `Field()`. Never use Pydantic v1 patterns like `.dict()` or
   `from_orm()`.

5. **Separation of extraction and validation**: the extractor returns raw fields
   + raw confidence + flags. The validator adjusts confidence and decides
   routing. Never mix extraction logic with validation rules.

## Coding conventions

- **Type hints on every function** (params and return). Use `from __future__
  import annotations` at the top of every module.
- **Docstrings**: module-level docstring on every file, class-level on every
  class. Function docstrings for public functions. Keep them concise.
- **No bare `except:`**. Always catch specific exceptions.
- **f-strings** for formatting (no `.format()` or `%`).
- **pathlib.Path** for file paths, not raw strings.
- **snake_case** for everything except class names (PascalCase).
- **Constants** are UPPER_SNAKE_CASE at module level.
- Keep functions short. If a function exceeds ~40 lines, split it.
- Prefer composition over inheritance.
- Tests use pytest. Name test files `test_<module>.py`.

## Current phase and what's next

**Done (Phase 1–2)**: ingest, preprocess, VLM extraction, validation + routing.

**Upcoming**:
- Phase 3: FastAPI service layer, Postgres models, Celery task queue, file storage
- Phase 4: React review dashboard (upload, confidence-coded queue, correct & approve)
- Phase 5: Analytics dashboard (accuracy, throughput, configurable rules)
- Phase 6: Active learning — fine-tune Donut or LayoutLMv3 on collected corrections,
  benchmark against VLM, add token-logprob confidence
- Phase 7: Docker deployment, portfolio case study with real metrics

## How to help

When generating code for this project:
- Follow the architecture above — new features slot into the right layer.
- Always use the existing Pydantic schemas from `schema.py` for data flow.
- Keep the 8GB VRAM constraint in mind for any ML code.
- Prefer robust error handling (the system processes real-world messy documents).
- Add type hints and docstrings matching the conventions above.
- When adding API endpoints, follow FastAPI best practices (dependency injection,
  async where beneficial, proper HTTP status codes, Pydantic response models).
- For frontend code, use React functional components with hooks + Tailwind CSS.

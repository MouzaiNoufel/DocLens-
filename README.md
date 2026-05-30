# Invoice IDP

An intelligent document processing pipeline for invoices. It ingests a PDF or
image, extracts structured fields with a vision-language model, validates them
against business rules, and routes each document to **auto-approve** or a
**human review** queue based on confidence.

This repo is **Phase 1–2** of the project: the ingest → extract → validate core.
The service layer, review dashboard, and active-learning loop come next (see the
roadmap below).

## Pipeline

```
PDF / image  →  preprocess  →  extraction engine  →  validation + routing  →  result
               (rasterize)     (Qwen2.5-VL, 4-bit)   (rules + confidence)     (JSON)
```

The extractor returns field values **and** a per-field confidence map. The
validator sharpens that confidence with hard checks — required fields present,
dates parseable, `subtotal + tax == total`, line items reconcile — then decides
routing. Rule-driven confidence is more trustworthy for routing than a model's
self-report alone.

## Requirements

- Python 3.10+
- An NVIDIA GPU with **8GB+ VRAM** (built and tuned for an RTX 3070 Ti)
- A recent NVIDIA driver + CUDA runtime

## Setup

```bash
python -m venv .venv
source .venv/bin/activate            # Windows (WSL2 recommended): source .venv/bin/activate

# 1. Install the CUDA build of PyTorch for your system. Example (CUDA 12.1):
pip install torch --index-url https://download.pytorch.org/whl/cu121
#    Pick the right command for your CUDA version at https://pytorch.org/get-started/locally/

# 2. Install everything else:
pip install -r requirements.txt
```

If `Qwen2_5_VLForConditionalGeneration` fails to import, upgrade transformers:
`pip install -U transformers`.

**Windows note:** `bitsandbytes` 4-bit is smoothest under **WSL2**. If you can't
use WSL2, run without quantization (`load_in_4bit=False` in `InvoiceExtractor`),
but the 3B model in fp16 needs ~7GB+ and is tight on 8GB.

## Run

```bash
python run.py path/to/invoice.pdf
```

Useful flags:

```bash
python run.py invoice.png --threshold 0.9      # stricter auto-approve bar
python run.py invoice.pdf --max-pixels 1048576 # 1024*1024, lower VRAM if you OOM
python run.py invoice.pdf --model Qwen/Qwen2-VL-2B-Instruct  # smaller fallback
```

Drop any invoice PDF or photo in and it works — the model reads both digital and
scanned/photographed invoices.

## Output

```json
{
  "fields": {
    "vendor_name": "Acme Supplies Ltd",
    "invoice_number": "INV-2024-0342",
    "invoice_date": "2024-03-14",
    "currency": "USD",
    "line_items": [ ... ],
    "subtotal": 1200.0,
    "tax": 96.0,
    "total": 1296.0
  },
  "field_confidence": { "vendor_name": 0.93, "total": 0.99, ... },
  "overall_confidence": 0.93,
  "flags": [],
  "routing": "auto_approve",
  "source_file": "invoice.pdf",
  "page_count": 1
}
```

- `routing: "auto_approve"` — confidence cleared the threshold with no critical flags.
- `routing: "needs_review"` — something needs a human: a missing required field,
  a `totals_mismatch`, an unparseable date, or low confidence.

## VRAM tuning (8GB)

The vision-token count from the image is the main driver of VRAM. If you hit
CUDA out-of-memory, in order: lower `--max-pixels` (try `1048576`), then drop
`--dpi` to 150, then switch to `--model Qwen/Qwen2-VL-2B-Instruct`.

## Roadmap

- [x] **Phase 1–2** — ingest, preprocess, VLM extraction, validation + routing *(this repo)*
- [ ] **Phase 3** — service layer: FastAPI, Postgres, async queue, file storage
- [ ] **Phase 4** — review dashboard: upload, confidence-coded queue, correct & approve
- [ ] **Phase 5** — analytics: accuracy/throughput, configurable rules
- [ ] **Phase 6** — active learning: fine-tune a specialized model (Donut / LayoutLMv3)
      on collected corrections, benchmark vs. the VLM
- [ ] **Phase 7** — deploy + portfolio case study with metrics

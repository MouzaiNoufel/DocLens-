#!/usr/bin/env python3
"""Run the invoice extraction pipeline on a single file.

    python run.py path/to/invoice.pdf
    python run.py path/to/invoice.png --threshold 0.9 --max-pixels 1048576
"""

from __future__ import annotations

import argparse
import json
import os
import sys

# Prevent transformers from importing TensorFlow/JAX (not needed for PyTorch inference).
os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_JAX", "0")

# Windows PowerShell's default codepage (cp1252) mangles UTF-8 output; force
# stdout to UTF-8 so em-dashes and accents print correctly.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# On Windows, PowerShell's default codepage (cp1252) mangles UTF-8 output.
# Force stdout to UTF-8 so Unicode characters print correctly regardless of shell.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from invoice_idp.preprocess import load_as_images
from invoice_idp.extractor import InvoiceExtractor, DEFAULT_MODEL, DEFAULT_MAX_PIXELS
from invoice_idp.validate import validate_and_route


def main() -> int:
    ap = argparse.ArgumentParser(description="Invoice IDP extraction pipeline")
    ap.add_argument("file", help="Path to an invoice PDF or image")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="Hugging Face model id")
    ap.add_argument("--threshold", type=float, default=0.85,
                    help="Auto-approve confidence threshold (0-1)")
    ap.add_argument("--dpi", type=int, default=200, help="Rasterization DPI for PDFs")
    ap.add_argument("--max-pixels", type=int, default=DEFAULT_MAX_PIXELS,
                    help="Cap on VLM image pixels; lower this if you hit CUDA OOM")
    args = ap.parse_args()

    print(f"[1/3] Loading {args.file} ...", file=sys.stderr)
    images = load_as_images(args.file, dpi=args.dpi)
    print(f"      {len(images)} page(s) loaded.", file=sys.stderr)

    print(f"[2/3] Loading {args.model} (4-bit) and extracting ...", file=sys.stderr)
    extractor = InvoiceExtractor(model_name=args.model, max_pixels=args.max_pixels)
    fields, confidence, flags = extractor.extract(images)

    print("[3/3] Validating and routing ...", file=sys.stderr)
    result = validate_and_route(
        fields, confidence, flags, auto_approve_threshold=args.threshold
    )
    result.source_file = args.file
    result.page_count = len(images)

    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

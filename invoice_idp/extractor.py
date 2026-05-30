"""Extraction engine.

Loads a 4-bit Qwen2.5-VL model and prompts it to return invoice fields as a
single JSON object, then parses that output robustly into `InvoiceFields`
plus a per-field confidence map.

The model's self-reported confidence is a *baseline*. The validation layer
sharpens it with hard business rules, and a later phase replaces it with
token-logprob confidence learned from human corrections.
"""

from __future__ import annotations

import json
import re
from typing import List, Tuple, Dict, Optional

from PIL import Image

from .schema import InvoiceFields

DEFAULT_MODEL = "Qwen/Qwen2.5-VL-3B-Instruct"

# Pixel budget fed to the VLM. More pixels = more detail but more vision tokens
# and more VRAM. 1280*1280 is a good balance for an 8GB card; drop to
# 1024*1024 (or lower) if you hit CUDA out-of-memory.
DEFAULT_MAX_PIXELS = 1280 * 1280

PROMPT = """You are an expert invoice data-extraction system.
Read the invoice image(s) and return ONLY a single JSON object - no prose, no
markdown fences.

Use exactly this shape:
{
  "vendor_name": string | null,
  "vendor_address": string | null,
  "invoice_number": string | null,
  "invoice_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "currency": string | null,
  "line_items": [
    {"description": string|null, "quantity": number|null,
     "unit_price": number|null, "amount": number|null}
  ],
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "_confidence": { "<field>": number_between_0_and_1 }
}

Rules:
- Use null for anything not on the invoice. Never guess a value.
- Numbers are plain JSON numbers: no currency symbols, no thousands separators.
- Dates are ISO 8601 (YYYY-MM-DD).
- "currency" is the ISO 4217 code (e.g. "USD", "EUR").
- In "_confidence", give one score per top-level field for how sure you are
  (0 = pure guess, 1 = certain).
Return the JSON object only."""

_NUMERIC_FIELDS = ("subtotal", "tax", "total")
_LINE_ITEM_NUMERIC = ("quantity", "unit_price", "amount")


class InvoiceExtractor:
    """Loads a 4-bit Qwen2.5-VL model and extracts structured invoice data."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        max_pixels: int = DEFAULT_MAX_PIXELS,
        load_in_4bit: bool = True,
    ) -> None:
        import torch
        from transformers import (
            Qwen2_5_VLForConditionalGeneration,
            AutoProcessor,
            BitsAndBytesConfig,
        )

        quant_config = None
        if load_in_4bit:
            quant_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
                bnb_4bit_compute_dtype=torch.float16,
            )

        self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            model_name,
            quantization_config=quant_config,
            torch_dtype=torch.float16,
            device_map="auto",
        )
        self.model.eval()
        # min/max pixels bound the vision-token count, which bounds VRAM.
        self.processor = AutoProcessor.from_pretrained(model_name, max_pixels=max_pixels)

    def extract(
        self, images: List[Image.Image], max_new_tokens: int = 1024
    ) -> Tuple[InvoiceFields, Dict[str, float], List[str]]:
        import torch
        from qwen_vl_utils import process_vision_info

        content = [{"type": "image", "image": img} for img in images]
        content.append({"type": "text", "text": PROMPT})
        messages = [{"role": "user", "content": content}]

        text = self.processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        ).to(self.model.device)

        with torch.no_grad():
            generated = self.model.generate(
                **inputs, max_new_tokens=max_new_tokens, do_sample=False
            )
        trimmed = [out[len(inp):] for inp, out in zip(inputs.input_ids, generated)]
        raw = self.processor.batch_decode(
            trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]
        return parse_model_output(raw)


def parse_model_output(
    raw: str,
) -> Tuple[InvoiceFields, Dict[str, float], List[str]]:
    """Turn raw model text into validated fields + a confidence map + flags."""
    data = _extract_json(raw)
    if data is None:
        return InvoiceFields(), {}, ["json_parse_failed"]

    confidence: Dict[str, float] = {}
    raw_conf = data.pop("_confidence", {})
    if isinstance(raw_conf, dict):
        for key, val in raw_conf.items():
            try:
                confidence[key] = max(0.0, min(1.0, float(val)))
            except (TypeError, ValueError):
                pass

    data = _clean_numbers(data)
    try:
        fields = InvoiceFields.model_validate(data)
        return fields, confidence, []
    except Exception:
        return InvoiceFields(), confidence, ["schema_validation_failed"]


def _extract_json(raw: str) -> Optional[dict]:
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", s, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _clean_numbers(data: dict) -> dict:
    out = dict(data)
    for field in _NUMERIC_FIELDS:
        if field in out:
            out[field] = _to_number(out[field])
    items = []
    for item in out.get("line_items", []) or []:
        if isinstance(item, dict):
            item = dict(item)
            for field in _LINE_ITEM_NUMERIC:
                if field in item:
                    item[field] = _to_number(item[field])
            items.append(item)
    if "line_items" in out:
        out["line_items"] = items
    return out


def _to_number(value):
    if value is None or isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.\-]", "", value.replace(",", ""))
        if cleaned in ("", "-", ".", "-."):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return value

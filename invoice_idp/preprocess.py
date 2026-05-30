"""Ingest / preprocess: turn an uploaded file into a list of RGB page images.

PDFs are rasterized with PyMuPDF (no system dependencies). The final
resolution cap that protects VRAM is applied later, in the extractor.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import List, Union

from PIL import Image

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}


def load_as_images(path: Union[str, Path], dpi: int = 200) -> List[Image.Image]:
    """Load a PDF or image file as a list of RGB PIL images (one per page)."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"No such file: {path}")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _rasterize_pdf(path, dpi=dpi)
    if suffix in IMAGE_SUFFIXES:
        return [Image.open(path).convert("RGB")]
    raise ValueError(f"Unsupported file type '{suffix}'. Give a PDF or an image.")


def _rasterize_pdf(path: Path, dpi: int) -> List[Image.Image]:
    import fitz  # PyMuPDF

    pages: List[Image.Image] = []
    with fitz.open(path) as doc:
        for page in doc:
            pix = page.get_pixmap(dpi=dpi)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            pages.append(img)
    return pages

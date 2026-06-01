# Lightweight API image for cloud demos.
# Runs in DOCLENS_DEMO_MODE=true — returns realistic mock extractions without
# loading the VLM. For real GPU-backed inference, install requirements.txt
# locally instead of using this image.

FROM python:3.11-slim

WORKDIR /app

# System deps: libgl/libglib for PyMuPDF, curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Slim Python deps (no torch / transformers / bitsandbytes in this image)
COPY api/requirements-deploy.txt ./
RUN pip install --no-cache-dir -r requirements-deploy.txt

# App code
COPY api/ ./api/
COPY invoice_idp/ ./invoice_idp/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DOCLENS_DEMO_MODE=true \
    UPLOAD_DIR=/tmp/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

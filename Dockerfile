# PlanCatalyst TSI data pipeline — batch image.
# Runs: fetch -> clean -> score/aggregate -> upload, via `python -m src.pipeline.run_pipeline`.
#
# Secrets (AZURE_*, ACR_*) are NOT baked in. Pass them at runtime via env
# (e.g. `docker run --env-file .env ...` or ACI environment variables).
# Build server-side with: scripts/acr_build.sh   (uses `az acr build`).

FROM python:3.10-slim

# - PYTHONUNBUFFERED: stream pipeline logs immediately (no buffering) for ACI/log tailing.
# - PYTHONDONTWRITEBYTECODE: skip .pyc clutter in the image layer.
# - PIP_NO_CACHE_DIR: keep the image small.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependency layer first so source edits don't bust the pip cache.
# All deps (pandas, numpy, openpyxl, azure-*) ship manylinux/pure-python
# wheels, so no apt build toolchain is required.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pipeline source + taxonomy source-of-truth. Paths resolve relative to the
# repo root (REPO_ROOT = parents[2]), which is /app here:
#   /app/src/...         (pipeline + src/config/settings.yaml)
#   /app/indicators/...  (indicators.yaml, country_codes.csv, SCORING_AUDIT.md)
COPY src/ ./src/
COPY indicators/ ./indicators/

# Run as non-root. Pre-create the local artifact dir the pipeline writes to
# (data/raw, data/clean, data/interim, data/organized) so it is writable.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

# Full pipeline by default; override CMD to run a single stage, e.g.
#   docker run ... python -m src.calculating.pipeline
ENTRYPOINT ["python", "-m", "src.pipeline.run_pipeline"]

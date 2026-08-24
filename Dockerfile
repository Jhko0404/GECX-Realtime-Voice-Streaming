# ==============================================================================
# Stage 1: Build React Frontend
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python BFF Gateway Runtime
# ==============================================================================
FROM python:3.11-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bff/ ./bff/
COPY --from=frontend-builder /app/web/dist ./web/dist

EXPOSE 8080

CMD ["uvicorn", "bff.main:app", "--host", "0.0.0.0", "--port", "8080"]

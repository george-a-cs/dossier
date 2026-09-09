FROM python:3.12-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY apps/api/pyproject.toml .
COPY apps/api/dossier ./dossier
COPY data/seed ./data/seed
RUN pip install --no-cache-dir . sqlite-vec

ENV DATABASE_PATH=/data/dossier.db
EXPOSE 8000
CMD ["uvicorn", "dossier.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

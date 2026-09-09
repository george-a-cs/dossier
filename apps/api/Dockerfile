FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml .
COPY dossier ./dossier
RUN pip install --no-cache-dir . sqlite-vec

ENV DATABASE_PATH=/data/dossier.db
EXPOSE 8000
CMD ["uvicorn", "dossier.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

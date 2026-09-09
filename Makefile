PYTHON := $(CURDIR)/.venv/bin/python
API_DIR := apps/api
WEB_DIR := apps/web
export PYTHONPATH := $(API_DIR)

.PHONY: api-dev web-dev test lint lint-api eval mcp up

api-dev:
	cd $(API_DIR) && $(PYTHON) -m uvicorn dossier.api.app:app --reload --host 0.0.0.0 --port 8000

web-dev:
	cd $(WEB_DIR) && npm run dev

test:
	cd $(API_DIR) && $(PYTHON) -m pytest -q

lint-api:
	cd $(API_DIR) && $(PYTHON) -m ruff check dossier tests

lint: lint-api
	cd $(WEB_DIR) && npx tsc --noEmit

eval:
	$(PYTHON) -m dossier.eval.harness

mcp:
	$(PYTHON) -m dossier.mcp

up:
	docker compose up --build

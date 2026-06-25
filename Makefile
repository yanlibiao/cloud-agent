.PHONY: build-sandbox run dev clean

build-sandbox:
	docker build -t cloud-agent-sandbox sandbox/

run:
	docker compose up

dev:
	docker compose up --build

dev-backend:
	cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm install && npm run dev

clean:
	docker compose down -v
	docker system prune -f --filter "label=cloud-agent=true"

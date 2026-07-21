# ══════════════════════════════════════════════════════════════════════════════
# ReqAI – Makefile
#
# Convenience targets for development, testing, and production deployment.
# Requires: make, docker, docker compose, openssl
#
# Usage:
#   make help           # list all targets
#   make dev            # start development stack
#   make deploy         # build and deploy production
# ══════════════════════════════════════════════════════════════════════════════

.PHONY: help dev dev-down build deploy deploy-down rollback \
        logs logs-backend logs-frontend logs-nginx \
        db-migrate db-seed db-shell redis-shell \
        test test-e2e test-cov lint format typecheck \
        clean clean-volumes generate-secrets health

# ── Colours ───────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m

# ── Variables ─────────────────────────────────────────────────────────────────
COMPOSE_DEV  := docker compose -f docker-compose.yml
COMPOSE_PROD := docker compose -f docker-compose.prod.yml
APP_VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT   ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE   ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# ─────────────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo ""
	@echo "$(CYAN)ReqAI — Available Make Targets$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ── Development ───────────────────────────────────────────────────────────────

dev: ## Start full development stack (postgres + redis + backend HMR + frontend HMR)
	$(COMPOSE_DEV) up --build

dev-detach: ## Start development stack in the background
	$(COMPOSE_DEV) up --build -d

dev-down: ## Stop and remove development containers (preserves volumes)
	$(COMPOSE_DEV) down

dev-reset: ## Stop dev stack and remove all volumes (full reset)
	$(COMPOSE_DEV) down -v

# ── Production Build ──────────────────────────────────────────────────────────

build: ## Build production Docker images
	@echo "$(CYAN)Building production images (version: $(APP_VERSION))...$(RESET)"
	APP_VERSION=$(APP_VERSION) BUILD_DATE=$(BUILD_DATE) GIT_COMMIT=$(GIT_COMMIT) \
	  $(COMPOSE_PROD) build --parallel --no-cache

deploy: ## Build and deploy production stack
	@[ -f .env.production ] || { echo "❌  .env.production not found. Copy .env.production.example and fill in values."; exit 1; }
	@echo "$(CYAN)Deploying ReqAI v$(APP_VERSION)...$(RESET)"
	APP_VERSION=$(APP_VERSION) BUILD_DATE=$(BUILD_DATE) GIT_COMMIT=$(GIT_COMMIT) \
	  $(COMPOSE_PROD) up --build -d --remove-orphans
	@echo "$(GREEN)✓ Deployment complete$(RESET)"
	@$(MAKE) health

deploy-down: ## Stop production stack (preserves volumes)
	$(COMPOSE_PROD) down

rollback: ## Re-deploy the previous image (does not rebuild)
	$(COMPOSE_PROD) up -d

# ── Logs ──────────────────────────────────────────────────────────────────────

logs: ## Tail all logs (development)
	$(COMPOSE_DEV) logs -f

logs-prod: ## Tail all logs (production)
	$(COMPOSE_PROD) logs -f

logs-backend: ## Tail backend logs (development)
	$(COMPOSE_DEV) logs -f backend

logs-nginx: ## Tail nginx logs (production)
	$(COMPOSE_PROD) logs -f nginx

# ── Database ──────────────────────────────────────────────────────────────────

db-migrate: ## Run pending database migrations (development)
	$(COMPOSE_DEV) exec backend npm run db:migrate

db-seed: ## Seed the development database
	$(COMPOSE_DEV) exec backend npm run db:seed

db-shell: ## Open a psql shell inside the postgres container (development)
	$(COMPOSE_DEV) exec postgres psql -U reqai -d reqai

redis-shell: ## Open a redis-cli shell (development)
	$(COMPOSE_DEV) exec redis redis-cli

# ── Testing ───────────────────────────────────────────────────────────────────

test: ## Run unit and integration tests
	cd backend && npm test

test-watch: ## Run tests in watch mode
	cd backend && npm run test:watch

test-cov: ## Run tests with coverage report
	cd backend && npm run test:cov

test-e2e: ## Run Playwright end-to-end tests
	cd e2e && npm test

# ── Code Quality ─────────────────────────────────────────────────────────────

lint: ## Lint both backend and frontend
	cd backend  && npm run lint
	cd frontend && npm run lint

format: ## Format both backend and frontend with Prettier
	cd backend  && npm run format
	cd frontend && npm run format

typecheck: ## TypeScript type-check both packages
	cd backend  && npm run typecheck
	cd frontend && node node_modules/typescript/bin/tsc --noEmit

# ── Health Checks ─────────────────────────────────────────────────────────────

health: ## Check API health endpoint
	@echo "$(CYAN)Checking API health...$(RESET)"
	@curl -sf http://localhost:3000/api/v1/health | python3 -m json.tool || \
	  curl -sf http://localhost:3000/api/v1/health

health-prod: ## Check production API health via nginx
	@echo "$(CYAN)Checking production health via nginx...$(RESET)"
	@curl -sf https://$${DOMAIN_NAME}/api/v1/health | python3 -m json.tool

# ── Secrets ───────────────────────────────────────────────────────────────────

generate-secrets: ## Generate strong JWT secrets and print them (requires openssl)
	@echo ""
	@echo "$(CYAN)Generated secrets — add these to your .env file:$(RESET)"
	@echo ""
	@printf "JWT_ACCESS_SECRET=%s\n"  "$$(openssl rand -hex 32)"
	@printf "JWT_REFRESH_SECRET=%s\n" "$$(openssl rand -hex 32)"
	@echo ""

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean: ## Remove compiled TypeScript output
	rm -rf backend/dist frontend/dist

clean-volumes: ## Remove all Docker volumes (⚠ destroys data)
	$(COMPOSE_DEV) down -v
	$(COMPOSE_PROD) down -v

prune: ## Remove dangling Docker images and build cache
	docker image prune -f
	docker builder prune -f

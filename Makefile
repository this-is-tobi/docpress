# =============================================================================
# Docpress - Makefile
# =============================================================================

# -----------------------------------------------------------------------------
# Variables
# -----------------------------------------------------------------------------

# Colors for terminal output
COLOR_RESET   := \033[0m
COLOR_BOLD    := \033[1m
COLOR_DIM     := \033[2m
COLOR_RED     := \033[31m
COLOR_GREEN   := \033[32m
COLOR_YELLOW  := \033[33m
COLOR_BLUE    := \033[34m
COLOR_MAGENTA := \033[35m
COLOR_CYAN    := \033[36m

# Paths
PROJECT_ROOT := $(shell pwd)

# Runtime
BUN := bun

# Docpress run arguments (e.g. `make dev ARGS="-U this-is-tobi"`)
ARGS :=

# -----------------------------------------------------------------------------
# Default target
# -----------------------------------------------------------------------------

.DEFAULT_GOAL := help

# -----------------------------------------------------------------------------
# Help
# -----------------------------------------------------------------------------

.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "$(COLOR_BOLD)$(COLOR_CYAN)  Docpress - Available Commands$(COLOR_RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} \
		/^## / { printf "\n$(COLOR_BOLD)$(COLOR_YELLOW)%s$(COLOR_RESET)\n", substr($$0, 4) } \
		/^[a-zA-Z0-9_-]+:.*##/ { printf "  $(COLOR_CYAN)%-24s$(COLOR_RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# -----------------------------------------------------------------------------
## ▸ Setup & Tools
# -----------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Installing dependencies..."
	@$(BUN) install
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Dependencies installed"

.PHONY: prepare
prepare: ## Install git hooks (husky)
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Installing git hooks..."
	@$(BUN) run prepare
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Git hooks installed"

.PHONY: clean
clean: ## Remove build artifacts, coverage and generated docs
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Cleaning project..."
	@rm -rf dist types coverage tsconfig.tsbuildinfo docpress
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Project cleaned"

# -----------------------------------------------------------------------------
## ▸ Build
# -----------------------------------------------------------------------------

.PHONY: build
build: ## Build the CLI (clean, types, bundle)
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Building project..."
	@$(BUN) run build
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Build complete"

.PHONY: build-types
build-types: ## Emit TypeScript declarations only
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Building types..."
	@$(BUN) run build:types
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Types built"

# -----------------------------------------------------------------------------
## ▸ Development
# -----------------------------------------------------------------------------

.PHONY: dev
dev: ## Fetch + build a site locally (pass ARGS="-U <username>")
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Running docpress..."
	@$(BUN) run dev $(ARGS)

.PHONY: docs-dev
docs-dev: ## Start the VitePress dev server on the generated site
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Starting VitePress dev server..."
	@$(BUN) run vp:dev

.PHONY: docs-preview
docs-preview: ## Preview the built VitePress site
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Previewing VitePress site..."
	@$(BUN) run vp:preview

# -----------------------------------------------------------------------------
## ▸ Quality & Testing
# -----------------------------------------------------------------------------

.PHONY: lint
lint: ## Lint the codebase
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Linting..."
	@$(BUN) run lint
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Lint passed"

.PHONY: format
format: ## Auto-fix lint issues
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Formatting..."
	@$(BUN) run format
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Formatting complete"

.PHONY: test
test: ## Run the unit test suite
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Running tests..."
	@$(BUN) run test
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Tests passed"

.PHONY: test-cov
test-cov: ## Run tests with coverage (thresholds enforced)
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Running tests with coverage..."
	@$(BUN) run test:cov
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Coverage report generated"

# -----------------------------------------------------------------------------
## ▸ Docker
# -----------------------------------------------------------------------------

.PHONY: docker-build
docker-build: ## Build the production Docker image
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Building Docker image..."
	@$(BUN) run build:docker
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Docker image built"

.PHONY: docker-run
docker-run: ## Run the Docker image (pass ARGS="-U <username>")
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Running Docker image..."
	@docker run --name docpress --rm -v $(PROJECT_ROOT)/docpress:/app/docpress:rw tobi-or-not/docpress $(ARGS)

.PHONY: docker-stop
docker-stop: ## Force-remove the running Docker container
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) Stopping Docker container..."
	@$(BUN) run stop:docker
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Docker container stopped"

# -----------------------------------------------------------------------------
## ▸ CI
# -----------------------------------------------------------------------------

.PHONY: ci
ci: ## Run the full CI validation (lint + tests with coverage)
	@echo ""
	@echo "$(COLOR_BOLD)$(COLOR_CYAN)  CI validation$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) [1/2] Linting..."
	@$(BUN) run lint
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Lint passed"
	@echo "$(COLOR_BLUE)→$(COLOR_RESET) [2/2] Running tests with coverage..."
	@$(BUN) run test:cov
	@echo "$(COLOR_GREEN)✓$(COLOR_RESET) Tests passed"
	@echo ""
	@echo "$(COLOR_BOLD)$(COLOR_GREEN)  ✓ CI validation complete$(COLOR_RESET)"
	@echo ""

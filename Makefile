# ── Sanjaya Monorepo Build & Publish ──────────────────────────────
#
# Python packages:
#   make build PKG=sanjaya-core          Build sdist + wheel
#   make snapshot PKG=sanjaya-core       Build a .devN snapshot
#   make publish PKG=sanjaya-core        Upload dist/ to PyPI via twine
#   make build-all                       Build all packages (stable)
#   make snapshot-all                    Build all packages (snapshot)
#   make publish-all                     Upload all packages to PyPI
#   make test PKG=sanjaya-core           Run tests for one package
#   make test-all                        Run tests for all packages
#
# TypeSpec (npm):
#   make tsp-build                       Compile TypeSpec → OpenAPI
#   make tsp-publish                     Publish sanjaya-api to npm
#   make tsp-snapshot                    Publish a dev-tagged snapshot to npm
#
# General:
#   make clean                           Remove all dist/ dirs
#
# Snapshot versions use PEP 440 .devN format, e.g. 0.1.0.dev1739378400
# These are excluded from plain `pip install` but available via:
#   pip install --pre sanjaya-core
#   pip install sanjaya-core==0.1.0.dev1739378400
# ──────────────────────────────────────────────────────────────────

PACKAGES := sanjaya-core sanjaya-django sanjaya-sqlalchemy
PKG_DIR   = packages/$(PKG)

# Map package name → directory
pkg_dir = packages/$(1)

.PHONY: build snapshot publish build-all snapshot-all publish-all \
        test test-all clean help \
        tsp-build tsp-publish tsp-snapshot \
        mssql-up mssql-down mssql-test \
        postgres-up postgres-down postgres-test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Single-package targets (require PKG=...) ─────────────────────

build: _require-pkg ## Build sdist + wheel for PKG
	rm -rf $(PKG_DIR)/dist
	uv run python -m build $(PKG_DIR)

snapshot: _require-pkg ## Build a .devN snapshot for PKG
	@echo "── Creating snapshot for $(PKG) ──"
	$(eval TOML := $(PKG_DIR)/pyproject.toml)
	$(eval INIT := $(shell grep -rl '__version__' $(PKG_DIR)/src --include='__init__.py' | head -1))
	$(eval BASE_VERSION := $(shell grep '^version' $(TOML) | head -1 | sed 's/.*"\(.*\)"/\1/'))
	$(eval DEV_N := $(shell date +%s))
	$(eval SNAP_VERSION := $(BASE_VERSION).dev$(DEV_N))
	@echo "  base version : $(BASE_VERSION)"
	@echo "  snapshot     : $(SNAP_VERSION)"
	@# Stamp pyproject.toml
	sed -i 's/^version = "$(BASE_VERSION)"/version = "$(SNAP_VERSION)"/' $(TOML)
	@# Stamp __init__.py
	sed -i 's/__version__ = "$(BASE_VERSION)"/__version__ = "$(SNAP_VERSION)"/' $(INIT)
	@# Build (clean first to avoid stale artifacts)
	rm -rf $(PKG_DIR)/dist
	uv run python -m build $(PKG_DIR)
	@# Revert so snapshot version is never committed
	sed -i 's/^version = "$(SNAP_VERSION)"/version = "$(BASE_VERSION)"/' $(TOML)
	sed -i 's/__version__ = "$(SNAP_VERSION)"/__version__ = "$(BASE_VERSION)"/' $(INIT)
	@echo "── Snapshot built: $(SNAP_VERSION) ──"

publish: _require-pkg ## Upload dist/ to PyPI for PKG
	uv run twine upload $(PKG_DIR)/dist/*

test: _require-pkg ## Run tests for PKG
	@if [ "$(PKG)" = "sanjaya-django" ]; then \
		DJANGO_SETTINGS_MODULE=tests.settings uv run pytest $(PKG_DIR)/; \
	else \
		uv run pytest $(PKG_DIR)/; \
	fi

clean: ## Remove all dist/ and *.egg-info dirs
	rm -rf packages/*/dist packages/*/src/*.egg-info

# ── Multi-package targets ────────────────────────────────────────

build-all: ## Build all packages (stable)
	@for pkg in $(PACKAGES); do \
		echo "── Building $$pkg ──"; \
		uv run python -m build packages/$$pkg; \
	done

snapshot-all: ## Build all packages (snapshot)
	@for pkg in $(PACKAGES); do \
		$(MAKE) snapshot PKG=$$pkg; \
	done

publish-all: ## Upload all packages to PyPI
	@for pkg in $(PACKAGES); do \
		echo "── Publishing $$pkg ──"; \
		uv run twine upload packages/$$pkg/dist/*; \
	done

test-all: ## Run tests for all packages
	@for pkg in $(PACKAGES); do \
		echo "── Testing $$pkg ──"; \
		if [ "$$pkg" = "sanjaya-django" ]; then \
			DJANGO_SETTINGS_MODULE=tests.settings uv run pytest packages/$$pkg/; \
		else \
			uv run pytest packages/$$pkg/; \
		fi; \
	done

# ── TypeSpec / npm targets ───────────────────────────────────────

tsp-build: ## Compile TypeSpec → OpenAPI
	cd api && pnpm install && pnpm build

tsp-publish: tsp-build ## Publish sanjaya-api to npm (stable)
	cd api && npm publish

tsp-snapshot: tsp-build ## Publish a dev-tagged snapshot to npm
	$(eval TSP_BASE := $(shell node -p "require('./api/package.json').version"))
	$(eval TSP_SNAP := $(TSP_BASE)-dev.$(shell date +%s))
	@echo "── TypeSpec snapshot: $(TSP_SNAP) ──"
	cd api && npm version $(TSP_SNAP) --no-git-tag-version && npm publish --tag dev
	cd api && npm version $(TSP_BASE) --no-git-tag-version
	@echo "── Published sanjaya-api@$(TSP_SNAP) (tag: dev) ──"

# ── MSSQL integration tests ──────────────────────────────────────

MSSQL_COMPOSE  := docker compose -f docker-compose.mssql.yml
MSSQL_SA_PASS  := Sanjaya_Test1
MSSQL_DB       := sanjaya_test
MSSQL_URL      := mssql+pyodbc://sa:$(MSSQL_SA_PASS)@localhost:1433/$(MSSQL_DB)?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&Encrypt=no

mssql-up: ## Start MSSQL container and create test database
	$(MSSQL_COMPOSE) up -d --wait
	@echo "── Creating database $(MSSQL_DB) ──"
	$(MSSQL_COMPOSE) exec -T mssql /opt/mssql-tools18/bin/sqlcmd \
		-S localhost -U sa -P "$(MSSQL_SA_PASS)" -C \
		-Q "IF DB_ID('$(MSSQL_DB)') IS NULL CREATE DATABASE [$(MSSQL_DB)]"
	@echo "── MSSQL ready at localhost:1433 ──"

mssql-down: ## Stop MSSQL container and remove volumes
	$(MSSQL_COMPOSE) down -v

mssql-test: mssql-up ## Run MSSQL integration tests (starts container if needed)
	SANJAYA_MSSQL_URL="$(MSSQL_URL)" uv run pytest packages/sanjaya-sqlalchemy/ -k mssql -v

# ── PostgreSQL integration tests ─────────────────────────────────

PG_COMPOSE     := docker compose -f docker-compose.postgres.yml
PG_PASSWORD    := Sanjaya_Test1
PG_DB          := sanjaya_test
PG_URL         := postgresql+psycopg://postgres:$(PG_PASSWORD)@localhost:5432/$(PG_DB)

postgres-up: ## Start PostgreSQL container
	$(PG_COMPOSE) up -d --wait
	@echo "── PostgreSQL ready at localhost:5432 ──"

postgres-down: ## Stop PostgreSQL container and remove volumes
	$(PG_COMPOSE) down -v

postgres-test: postgres-up ## Run PostgreSQL integration tests (starts container if needed)
	SANJAYA_POSTGRES_URL="$(PG_URL)" uv run pytest packages/sanjaya-sqlalchemy/ -k postgres -v

# ── Internal ─────────────────────────────────────────────────────

_require-pkg:
ifndef PKG
	$(error PKG is required. Usage: make <target> PKG=sanjaya-core)
endif
ifeq ($(filter $(PKG),$(PACKAGES)),)
	$(error Unknown PKG=$(PKG). Must be one of: $(PACKAGES))
endif

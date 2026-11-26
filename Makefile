# Command contract: setup, fmt, lint, type, test, test-some, check. check is the fast gate and runs offline.
.DEFAULT_GOAL := help
COVERAGE := --experimental-test-coverage --test-coverage-lines=90 --test-coverage-branches=80 --test-coverage-include='src/**' --test-coverage-include='tooling/**'

.PHONY: help setup dev demo fmt lint type test test-some check check-version check-links

help: ## List the commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-14s %s\n", $$1, $$2}'

setup: ## Install dev dependencies (frozen) and the git hooks
	npm ci --no-audit --no-fund
	git config core.hooksPath .githooks

dev: ## No dev server: run a tool, e.g. node tools/schedules.mjs --help
	@node tools/schedules.mjs --help

demo: ## Run schedules against the invented test tenant: no Qlik account needed
	QCT_QLIK_BIN=tests/fixtures/fake-qlik.mjs node tools/schedules.mjs --config examples/demo.config.json

fmt: ## Format everything the repo owns
	npx biome check --write .

lint: ## Lint and format check; warnings fail
	npx biome ci --error-on-warnings .

type: ## Type-check the JavaScript (JSDoc, strict)
	npx tsc -p .

test: ## All offline tests, with the coverage floor
	node --test $(COVERAGE) "tests/**/*.test.mjs"

test-some: ## Tests matching a name: make test-some T=rrule
	node --test --test-name-pattern="$(T)" "tests/**/*.test.mjs"

check-version: ## package.json version equals the newest CHANGELOG entry
	node tooling/check-version.mjs

check-links: ## Relative links in Markdown point at files that exist
	node tooling/check-links.mjs

check: lint type test check-version check-links ## The fast gate: run before you push

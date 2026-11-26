# 0001 · Stack

**Status:** accepted · **Date:** 2026-11-26

- **Runtime:** Node 22.12 or later (`.nvmrc`, `engines`), ES modules, no runtime dependencies. The tools shell out to qlik-cli rather than calling the REST API directly, so authentication, regions and API versions stay qlik-cli's job.
- **Types:** plain `.mjs` with JSDoc, checked by TypeScript 7.0.2 in strict mode (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`). No build step, so a reader can run a tool straight from a clone.
- **Lint and format:** Biome 2.6.9, recommended rules, warnings fail.
- **Tests:** `node:test`, with Node's built-in coverage and a floor. No test framework dependency.
- **Package manager:** npm with a committed lockfile; CI installs with `npm ci`. Dev dependencies only.
- **Runner:** `make`, with the commands `setup`, `dev`, `fmt`, `lint`, `type`, `test`, `test-some`, `check`.
- **Hooks:** plain scripts in `.githooks/` (set by `make setup`), which chain to any local hook in `.git/hooks` first.
- **Seam:** `createQlik({ exec })` is the single point every external call passes through; tests replace it.

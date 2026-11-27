# Changelog

Each release is an annotated git tag (`vX.Y.Z`). Until v1.0.0, a minor version can change a tool's options or its `--json` fields; each such change is listed here. From v1.0.0, breaking changes bump the major version.

## v0.1.1 · schedules fix

- **Schedules** reads tasks from Qlik's Scheduling Tasks API (`/api/scheduling/tasks`), which superseded `/api/v1/tasks`. Same records, same `--json` rows.
- **Schedules** reads every page of spaces, apps, tasks and reloads. v0.1.0 read only the first page (100 spaces, 200 apps, 100 tasks, 100 reloads), so on a larger tenant an app whose task was past the first page showed as unscheduled.
- **Core:** `qlik.all(path, query)` follows a list's next links to the end, whichever cursor the API uses.
- Tests: the fake qlik-cli pages every list two records at a time, and a test checks that an app whose task is on page two of tasks is scheduled.

## v0.1.0 · schedules

- **Schedules** (`tools/schedules.mjs`): every app in a tenant with its reload schedule in words, next run, last reload, result and what started it. Table or `--json`. Read-only.
- **Core:** one config file (`qlik-cloud-tools.config.json`) naming each tenant's qlik-cli context and time zone, and one qlik-cli wrapper every tool shares. API keys stay in qlik-cli's own config.
- `make demo` runs the tool against an invented tenant, with no Qlik account.
- Repo gate: `make check` (Biome lint and format, strict JSDoc type check, offline tests with a coverage floor, version and link checks), git hooks, and CI with a secret scan, dependency review and an AI-attribution check.

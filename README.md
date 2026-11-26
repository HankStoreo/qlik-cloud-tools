# qlik-cloud-tools

See what your Qlik Cloud tenant is actually doing, from the command line. One command shows every app's reload schedule, when it runs next, and whether its last reload worked, so failures and unscheduled apps stand out.

![Typing node tools/schedules.mjs prints a table of apps by space with schedule, next run, last reload, result and what started it. One failed reload is red; two apps with no schedule are grey.](docs/media/schedules.gif)

Small tools built on [qlik-cli](https://qlik.dev/toolkits/qlik-cli/). Read-only tools come first, so you can point them at your own tenant safely. Node 22 or later, no runtime dependencies. The data above is invented: `make demo` reproduces it with no Qlik account.

[Changelog](CHANGELOG.md) · [Architecture](docs/Architecture.md) · [Testing](docs/Testing.md) · [Security](SECURITY.md) · [MIT licence](LICENSE)

| Tool | What it answers | Writes to Qlik? |
| --- | --- | --- |
| [Schedules](#schedules) | What is my tenant going to reload tonight, and what isn't scheduled at all? | No |

More tools follow, one release at a time. See the [changelog](CHANGELOG.md).

## Quick start

Try it with no Qlik account first. This runs the schedules tool against an invented tenant from the tests:

```sh
git clone https://github.com/HankStoreo/qlik-cloud-tools.git
cd qlik-cloud-tools
make setup      # dev dependencies and git hooks; the tools themselves need none
make check      # lint, types, tests: offline, no credentials
make demo
```

Then point it at your own tenant:

1. Install qlik-cli and create a context for your tenant. The context holds the tenant URL and API key; these tools never read or store the key.

   ```sh
   qlik context create my-tenant --server https://your-tenant.eu.qlikcloud.com --api-key <key>
   ```

2. Copy the example config and name your context in it:

   ```sh
   cp qlik-cloud-tools.config.example.json qlik-cloud-tools.config.json
   ```

   ```json
   {
     "timeZone": "Europe/Paris",
     "defaultTenant": "prod",
     "tenants": {
       "prod": { "context": "my-tenant" },
       "test": { "context": "my-test-tenant", "timeZone": "America/New_York" }
     }
   }
   ```

   | Field | Meaning | Default |
   | --- | --- | --- |
   | `tenants.<name>.context` | The qlik-cli context to run against | required |
   | `tenants.<name>.timeZone` | IANA zone to print this tenant's times in | `timeZone` |
   | `timeZone` | IANA zone for printed times | your system's zone |
   | `defaultTenant` | The tenant used when you don't pass `--tenant` | the first one listed |
   | `qlikBin` | Path to qlik-cli | `qlik` on your `PATH` |

   `qlik-cloud-tools.config.json` is git-ignored. Environment variables are in [.env.example](.env.example).

## Schedules

Every app in the tenant with its reload schedule, next run and last reload, in one table. Read-only: it makes four list calls (spaces, apps, tasks, reloads) and changes nothing.

```sh
node tools/schedules.mjs                  # default tenant, as a table
node tools/schedules.mjs --tenant test    # another tenant from the config
node tools/schedules.mjs --json           # rows as JSON, each with its app's tasks
```

Output, from the demo tenant (the video at the top shows it in colour):

```text
Space       App      Schedule                             Next run         Last reload       Result     By
Finance     Margin   after Revenue                                         Mon 2 Mar 05:09   succeeded  task
            Revenue  Weekdays 05:00                       Tue 3 Mar 05:00  Mon 2 Mar 05:01   succeeded  task
Operations  Rota     Sat 09:30 (disabled)                                  Fri 27 Feb 14:30             unrecorded
            Stock    Hourly every 2 :15 America/New_York  Mon 2 Mar 00:15  Sun 1 Mar 22:00   failed     API
Personal    Sandbox  none                                                                    never
sp-gone     Orphan   none                                                                    never

demo: 6 apps, 4 scheduled, 2 not. Times UTC.
```

On a terminal, failed reloads print red and unscheduled apps grey.

How to read it:

- **Schedule** is the app's task in words. A task starts on a calendar (`Weekdays 05:00`) or when another task finishes (`after Revenue`, with the status it waits for if that isn't success). A task's own zone is shown when it differs from the zone the table prints in. `none` means no task.
- **Next run** is blank for a chained task: Qlik only knows it once the parent runs.
- **By** says what started the last reload: `task`, `browser` (the reload button) or `API` (including qlik-cli). `unrecorded` means the app has a reload time but no entry in the reload history: a reload from the data load editor, or one older than the history.
- A **space shown as an ID** is one your API key can't see.

Schedules come from the tasks API (`/api/v1/tasks`). The older reload-tasks endpoint is deprecated and returns nothing on current tenants.

`--json` gives one object per app (`space`, `spaceType`, `app`, `id`, `schedule`, `nextRun`, `lastReload`, `lastStatus`, `lastBy`, and `tasks` with each task's recurrence, parent and last run), for other tools to read.

**Limits.** One page of each list: up to 100 spaces, 200 apps, 100 tasks and the 100 most recent reloads. An app whose last reload is older than that shows as `unrecorded`. An app with more than one task shows its first task's schedule; `--json` lists them all.

## Repo map

| Path | What's there |
| --- | --- |
| `src/` | The core (config loader, the one qlik-cli wrapper) and each tool's logic, as plain functions |
| `tools/` | One command-line entry point per tool |
| `tests/` | Offline tests: `unit/` for the functions, `cli/` for the commands against a fake qlik-cli, `fixtures/` with invented data |
| `tooling/` | Scripts the gate runs (version, links, AI attribution), with tests |
| `docs/` | [Architecture](docs/Architecture.md), [Testing](docs/Testing.md) and [decisions](docs/decisions/) |

`make help` lists every command. Contributions: [CONTRIBUTING.md](CONTRIBUTING.md).

## Limitations

- Needs qlik-cli 3 and an API key with read access to the spaces you want to see.
- Qlik Cloud only; not tested against Qlik Sense client-managed.
- Times print in English (`Mon 2 Mar 05:00`) whatever your locale.

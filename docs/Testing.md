# Testing

`make check` runs everything below except tier (c). It is offline and needs no credentials.

| Tier | What | Where | Command |
| --- | --- | --- | --- |
| (a) Pure unit | Functions on invented data: RRULE wording, row building, table format, config validation | `tests/unit/` | `make test` |
| (b) External calls faked | Commands run end to end against `tests/fixtures/fake-qlik.mjs`, a stand-in for qlik-cli that answers from `tenant.json` | `tests/cli/` | `make test` |
| (c) Live tenant | Not in this repo. Run a tool against your own tenant by hand | | |

- **Fixtures are invented.** `tests/fixtures/tenant.json` is made up; never replace it with an export from a real tenant.
- **Determinism.** Every qlik-cli call goes through the `exec` seam in `src/qlik.mjs`; tests replace it or point `QCT_QLIK_BIN` at the fake. Times are fixed ISO strings formatted in an explicit zone, never "now".
- **Coverage floor.** `make test` fails below 90% of lines or 80% of branches across `src/` and `tooling/`. Raise the floor when coverage rises; don't lower it.
- **One test:** `make test-some T=rrule`.
- Tests that exist for a repo rule name its ID, e.g. `check-trailers (Q7)`.

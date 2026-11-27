# Contributing

Issues and pull requests are welcome. Small ones are easiest to review.

1. `make setup`, then `make check` before you push. The pre-push hook runs it too.
2. Keep `check` offline: tests use the fake qlik-cli in `tests/fixtures/` and invented data. Never commit an export from a real tenant, a tenant URL or a key.
3. Tests change in the same pull request as the code they cover. See [docs/Testing.md](docs/Testing.md).
4. Use Conventional Commit subjects (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Commits and pull requests must not carry AI co-author trailers or session links; the hook and CI reject them. You own what you commit.
5. A change to a tool's options or `--json` fields needs a `CHANGELOG.md` entry.
6. If a tool's output changes, re-record the README video with `make media` (needs [VHS](https://github.com/charmbracelet/vhs)) and watch it through before committing. Recordings use the demo tenant only.

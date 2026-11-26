# 0002 · Config and credentials

**Status:** accepted · **Date:** 2026-11-26

One JSON file, `qlik-cloud-tools.config.json` (git-ignored), read by `src/config.mjs` and nowhere else. It names tenants; each tenant names a qlik-cli context and, optionally, a time zone. `QCT_CONFIG` and `--config` point at another file; `QCT_QLIK_BIN` overrides the qlik-cli path.

The file holds no secrets. API keys live in the qlik-cli context, so the tools never read, store or print one, and there is no secret type to keep apart from the rest of the config.

Times print in the tenant's zone, else the config's, else the system's. Nothing assumes a zone.

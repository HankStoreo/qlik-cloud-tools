# Architecture

Each tool is a thin command in `tools/` over plain functions in `src/`. The functions take data in and return data or text, so tests call them directly without Qlik.

```text
tools/<tool>.mjs        parse arguments, load config, print
   │
   ├─ src/config.mjs    the one config loader: tenants, contexts, time zones
   ├─ src/qlik.mjs      the one qlik-cli wrapper; every Qlik call goes through it
   └─ src/<tool>.mjs    fetch (through the wrapper) → build rows → format
```

Rules the code keeps:

- **One wrapper.** Every call to Qlik goes through `createQlik()` in `src/qlik.mjs`. It always passes `--context`, so a tool can't hit the wrong tenant by accident, and its `exec` argument is the seam tests replace ([0001](decisions/0001-stack.md)).
- **Credentials stay in qlik-cli.** The config names a qlik-cli context; the context holds the tenant URL and API key. No tool reads a key, so none can log one ([0002](decisions/0002-config.md)).
- **Every page.** A list is read with `qlik.all()`, which follows each page's next link to the end, so a tool never works from the first page of a list.
- **Fetch, then pure functions.** Each tool's `fetch…` function is its only I/O; everything after it is a pure function of the fetched data and the time zone.
- **Read-only first.** A tool that writes to a tenant will say so in the README table and take a dry run by default.

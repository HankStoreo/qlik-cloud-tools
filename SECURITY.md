# Security

## Supported versions

Only the latest release gets fixes. This project is pre-1.0, so update to the newest tag.

## Reporting a vulnerability

Report it privately through this repository's **Security** tab ("Report a vulnerability"). Please don't open a public issue. You should get a reply within a week.

The tools run qlik-cli with the context you name and never read, store or print API keys. The likely issues are a tool calling qlik-cli with arguments built from untrusted input, or a tool that should be read-only changing something in a tenant.

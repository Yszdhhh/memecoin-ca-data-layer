# GMGN tracked-input repair acceptance

## Scope and result

- No provider, credential, source-code, test, wallet, live aggregate, or request-budget operation occurred in this repair.
- Replaced ignored `node_modules` task inputs with tracked `package.json` and `package-lock.json`, which pin the installed `gmgn-cli` dependency.
- Removed the ignored implementation run-manifest declaration from the audit task; the audit already depends on the committed sanitized implementation report.
- Preserved the affected task statuses, roles, dependencies, forbidden actions, live report contents, audit verdict, frozen-wallet list, and request bounds.
- Local Harness acceptance is rerun after this metadata-only repair so `harness:doctor` can require tracked evidence reproducibly.

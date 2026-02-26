# Forward Integrations Catalog

Customer-facing catalog of Forward ecosystem integrations that are field-built and self-supported.

## Support Model

All catalog entries are best-effort and self-supported by listed maintainers.
Forward field teams do not provide SLA-backed support for these integrations.

## Repository Layout

- `catalog/integrations.json` - source of truth for listing data.
- `schema/integration.schema.json` - schema contract for registry entries.
- `scripts/` - validation, link checks, and site build utilities.
- `site/` - static site source for GitHub Pages.
- `.github/workflows/` - CI and Pages deploy workflows.

## Local Validation

```bash
node scripts/validate-registry.mjs
node scripts/check-links.mjs
node scripts/build-site.mjs
```

## Local Preview

```bash
python -m http.server -d dist 8080
# open http://localhost:8080
```

## Adding an Integration

1. Add an entry to `catalog/integrations.json`.
2. Ensure required repo docs exist (`README.md`, `SUPPORT.md`, `SECURITY.md`, LICENSE).
3. Open a PR and pass CI checks.

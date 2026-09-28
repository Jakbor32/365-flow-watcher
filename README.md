# 365 Flow Watcher

Watch, audit and secure Power Automate flows across your Microsoft 365 tenant.

> Work in progress. The full README (features, screenshots, architecture) comes
> with module 6, see [docs/PLAN.md](docs/PLAN.md).

## Try it

```bash
npm install
DEMO_MODE=true npm run dev          # or: cp .env.example .env && docker compose up -d
```

Configuration for a real tenant: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Development

```bash
npm run check    # lint + typecheck + format check + tests
```

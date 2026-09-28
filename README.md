# 365 Flow Watcher

Watch, audit and secure Power Automate flows across your Microsoft 365 tenant: failing runs, orphaned flows, who has access.

> Work in progress. Screenshots and a live demo come with module 6 ([plan](docs/PLAN.md)).

## Try the demo

```bash
npm install
DEMO_MODE=true npm run dev    # http://localhost:3000
```

## Connect your tenant

1. [Register an app in Entra ID](docs/setup/1-entra-app.md)
2. [Find your Power Platform environment](docs/setup/2-environment.md)
3. [Run it with Docker](docs/setup/3-run.md)

All settings: [configuration.md](docs/configuration.md)

## Development

```bash
npm run check   # lint, typecheck, format, tests
```

MIT licensed.

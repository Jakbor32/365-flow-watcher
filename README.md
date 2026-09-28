# 365 Flow Watcher

[![CI](https://github.com/Jakbor32/365-flow-watcher/actions/workflows/ci.yml/badge.svg)](https://github.com/Jakbor32/365-flow-watcher/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Watch, audit and secure Power Automate flows across your Microsoft 365 tenant: what is failing, what nobody owns any more, and who has access.

![Walkthrough: filter orphaned flows, open one, recover it, check insights](docs/images/walkthrough.gif)

<sub>All screenshots use the built-in demo tenant (fictional Contoso data).</sub>

## Why

The Power Automate portal shows flows one at a time. When someone leaves, their flows keep running on their connections until they break, and the failure emails go to a disabled mailbox. This dashboard shows the whole environment at once and lets an admin fix ownership before it becomes an incident.

## Features

- **Inventory** of every cloud flow, worst first: failures, last run, 14-day sparkline, filters, search, CSV export
- **Run history** with error code, failing action and message
- **Orphaned flows**: owner disabled or deleted and no active co-owner, with one-click **Recover**
- **Access**: see owners, grant or remove co-owners (off by default, managers only, audited)
- **Insights**: success rate, most common errors, most failing flows, ownership risk
- **View as** another person, **Diagnostics** for setup, dark and light theme, works on a phone

<table>
  <tr>
    <td><img src="docs/images/inventory.webp" alt="Flow inventory"></td>
    <td><img src="docs/images/flow-detail.webp" alt="Orphaned flow with run history and access"></td>
  </tr>
  <tr>
    <td><img src="docs/images/insights.webp" alt="Insights: runs per day, most failing flows, ownership risk"></td>
    <td><img src="docs/images/recover.webp" alt="Recovering an orphaned flow"></td>
  </tr>
</table>

<table>
  <tr>
    <td valign="top" width="25%"><img src="docs/images/mobile-inventory.webp" alt="Inventory on a phone"></td>
    <td valign="top" width="25%"><img src="docs/images/mobile-detail.webp" alt="Flow detail on a phone"></td>
    <td valign="top" width="50%"><img src="docs/images/inventory-light.webp" alt="Light theme"></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><sub>On a phone</sub></td>
    <td align="center"><sub>Light theme</sub></td>
  </tr>
</table>

## How it works

```mermaid
flowchart LR
    B["Admin's browser<br/>(MSAL)"] -- "1. sign in" --> E["Microsoft Entra ID"]
    E -- "2. Flow + Graph tokens<br/>(delegated)" --> B
    B -- "3. API call + tokens" --> S["365 Flow Watcher<br/>Next.js server"]
    S -- "flows, runs, permissions" --> F["Power Automate<br/>admin API"]
    S -- "owners, account status" --> G["Microsoft Graph"]
```

- The server has **no secret**. It checks the tokens (tenant, audience, same user), reads the user from Graph and calls Microsoft with the user's own permissions.
- Nothing is stored. Results are cached for two minutes, per user.

How a flow is marked orphaned:

```mermaid
flowchart LR
    A{"Owner active?"} -- yes --> OK["Managed"]
    A -- "no: disabled<br/>or deleted" --> B{"Active<br/>co-owner?"}
    B -- yes --> OK
    B -- no --> O["Orphaned"] -- "Recover" --> R["New co-owner<br/>re-signs connections"]
```

## Try it

```bash
docker compose up -d     # with DEMO_MODE=true in .env (copy .env.example)
```

or `npm install && DEMO_MODE=true npm run dev`, then open http://localhost:3000.

## Connect your tenant

1. [Register an app in Entra ID](docs/setup/1-entra-app.md)
2. [Find your Power Platform environment](docs/setup/2-environment.md)
3. [Run it with Docker](docs/setup/3-run.md)

All settings: [configuration.md](docs/configuration.md). Something off after signing in? Open **Diagnostics**.

## Security

- Delegated permissions only, no client secret, no database.
- Writes (grant/remove access) are off unless `ENABLE_GRANT_ACCESS=true`, limited to `ACCESS_MANAGERS`, confirmed in the UI and logged as JSON audit lines.
- Strict per-request CSP with a nonce; the container runs as non-root on a read-only filesystem.
- Trade-offs: MSAL keeps tokens in `localStorage` so a sign-in survives new tabs (CSP limits the XSS risk); there is no rate limiting, as this is an internal admin tool.

## Development

```bash
npm run check   # lint, typecheck, format, tests
```

CI runs the same checks plus a production build, `npm audit` and a Docker smoke test on every push.

## License

[MIT](LICENSE)

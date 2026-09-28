# Configuration

365 Flow Watcher reads all configuration from environment variables **at
runtime**. Nothing is baked into the build, so the same Docker image works for
any tenant. Copy `.env.example` to `.env` and fill it in.

There are **no secrets** in this list. The app is a single-page application
that signs users in with Microsoft Entra ID (MSAL) and calls Microsoft APIs
with the signed-in user's own delegated token. There is no client secret, no
certificate and no service account password to store or rotate.

## Quick reference

| Variable                        | Required  | Example                               | What it does                                                                                                        |
| ------------------------------- | --------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DEMO_MODE`                     | no        | `true`                                | Seeded fake tenant, no sign-in. When `true`, every other variable is ignored.                                       |
| `AZURE_TENANT_ID`               | live mode | `8f3c...-...`                         | Your Entra ID tenant. Users sign in against it.                                                                     |
| `AZURE_CLIENT_ID`               | live mode | `2a91...-...`                         | The app registration this app signs in as.                                                                          |
| `APP_URL`                       | live mode | `https://flows.contoso.com`           | Public address of the app. Must match the redirect URI in the app registration.                                     |
| `POWER_PLATFORM_ENVIRONMENT_ID` | live mode | `Default-8f3c...` or `a1b2...`        | The Power Platform environment whose flows are shown.                                                               |
| `WATCHED_FLOW_ACCOUNTS`         | no        | `svc-automation@contoso.com`          | Only show flows owned by these accounts. Empty = every flow in the environment.                                     |
| `DASHBOARD_USERS`               | no        | `ops@contoso.com,it-lead@contoso.com` | Who may open the dashboard. Empty = anyone who can sign in (see [restricting access](#3-restrict-who-can-sign-in)). |
| `ACCESS_MANAGERS`               | no        | `it-lead@contoso.com`                 | Who may grant/revoke flow access and preview other accounts.                                                        |
| `PREVIEW_MANAGERS`              | no        | `helpdesk@contoso.com`                | Who may preview another account's flows. Empty = same as `ACCESS_MANAGERS`.                                         |
| `ENABLE_GRANT_ACCESS`           | no        | `false`                               | Turns on grant/revoke. This **writes** to your tenant, so it is off by default.                                     |

Lists accept commas, semicolons or spaces and are case-insensitive. Values are
matched against both the user principal name (UPN) and the primary email.

If something is missing or malformed, the app shows a page listing every
problem (variable names only, never values), and `GET /api/health` returns
HTTP 500 with the same list, so a broken container is marked unhealthy.

## Step by step: where each value comes from

You need an account that can create app registrations in Entra ID and, for
step 4, the Power Platform administrator role (or System Administrator in the
target environment).

### 1. Create the app registration (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`)

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com).
2. Go to **Identity > Applications > App registrations > New registration**.
3. Fill in:
   - **Name:** `365 Flow Watcher` (anything you will recognise).
   - **Supported account types:** _Accounts in this organizational directory
     only (Single tenant)_.
   - **Redirect URI:** platform **Single-page application (SPA)**, value =
     your `APP_URL` followed by `/`, for example `http://localhost:3000/`.
     The platform must be SPA, not Web: SPA enables the PKCE flow MSAL uses
     in the browser.
4. Click **Register**. The **Overview** page now shows:
   - **Application (client) ID** → `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_TENANT_ID`

Do **not** create a client secret or certificate. The app does not need one.

Running the app on more than one address (for example locally and in
production)? Add each address as another SPA redirect URI under
**Authentication > Single-page application**.

### 2. Add API permissions

In the app registration, go to **API permissions > Add a permission**.

| API                                                                                            | Type      | Permission           | Why                                                                               |
| ---------------------------------------------------------------------------------------------- | --------- | -------------------- | --------------------------------------------------------------------------------- |
| **Power Automate** (under _APIs my organization uses_, may appear as _Microsoft Flow Service_) | Delegated | `User`               | Basic access to the Flow Service API.                                             |
|                                                                                                | Delegated | `Flows.Read.All`     | Read flow definitions, owners and permissions.                                    |
|                                                                                                | Delegated | `Activity.Read.All`  | Read run history and errors.                                                      |
| **Microsoft Graph**                                                                            | Delegated | `User.Read`          | Sign-in, read the signed-in user's profile.                                       |
|                                                                                                | Delegated | `User.ReadBasic.All` | Resolve flow owners and the people you grant access to.                           |
|                                                                                                | Delegated | `User.Read.All`      | _Optional._ Read `accountEnabled` to detect flows owned by **disabled** accounts. |

Then click **Grant admin consent for &lt;your tenant&gt;**. Every row should
show a green check.

About orphaned flows: without `User.Read.All` the app can still detect flows
whose owner was **deleted** (Graph returns 404 for them), but not owners who
were only **disabled**, which is the common case right after someone leaves.
The diagnostics page tells you which of the two you have.

### 3. Restrict who can sign in

By default every user in your tenant could sign in to a new app
registration. Decide who should see your flow inventory:

1. In the Entra admin center, go to **Identity > Applications > Enterprise
   applications** and open `365 Flow Watcher` (same name as the app
   registration).
2. **Properties > Assignment required? = Yes**, then **Save**.
3. **Users and groups > Add user/group** and add the people or, better, a
   security group.

Now anyone not assigned is rejected by Entra ID itself, with MFA and
Conditional Access applied, before the app ever runs. `DASHBOARD_USERS` is a
second, app-level layer on top of that; you can leave it empty if you rely on
assignment.

### 4. Find the environment (`POWER_PLATFORM_ENVIRONMENT_ID`)

Any of these works:

- **Power Platform admin center:** open
  [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com),
  go to **Manage > Environments**, select the environment. The **Details**
  panel shows **Environment ID**.
- **Power Automate portal:** open
  [make.powerautomate.com](https://make.powerautomate.com), pick the
  environment in the top-right switcher, and copy the ID from the address
  bar: `https://make.powerautomate.com/environments/<ENVIRONMENT_ID>/flows`.
- **PowerShell:**
  ```powershell
  Install-Module Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser
  Add-PowerAppsAccount
  Get-AdminPowerAppEnvironment | Select-Object DisplayName, EnvironmentName
  ```
  `EnvironmentName` is the ID.

The default environment's ID looks like `Default-<your tenant ID>`. Others are
plain GUIDs.

The dashboard reads flows through the **admin** endpoints of the Flow Service,
so the people using it need the **Power Platform administrator** role in
Entra ID, or the **System Administrator** security role in that environment.
Users without it will see a clear permission error on the diagnostics page.

### 5. Set `APP_URL`

The address people type in the browser, without a trailing slash:

- Local: `http://localhost:3000`
- Behind a reverse proxy or on a PaaS: `https://flows.contoso.com`

It must match a redirect URI from step 1 exactly (scheme, host and port).
Plain `http://` is rejected unless the host is `localhost`, because MSAL
tokens must not travel over an unencrypted connection.

### 6. Optional: scope, allowlists and grant access

- `WATCHED_FLOW_ACCOUNTS`: leave empty to see **every** flow in the
  environment (recommended, it is the only way to find all orphaned flows).
  Set it to shared service accounts if you only care about "production"
  flows.
- `ACCESS_MANAGERS` / `PREVIEW_MANAGERS`: people allowed to use the
  management features. Keep this list short.
- `ENABLE_GRANT_ACCESS=true`: shows **Grant access** and **Revoke** on each
  flow. Granting adds the person as a co-owner with `CanEdit`; revoking
  removes a co-owner. Both ask for confirmation and are logged on the server
  with who did what. Requires at least one `ACCESS_MANAGERS` entry, and the
  signed-in manager needs the admin role from step 4. The primary owner can
  never be revoked.

## Checking your setup

Sign in and open **Diagnostics**. It checks, one by one: token audience and
tenant, each granted scope, Graph access, whether `accountEnabled` is
readable, and whether the Flow Service admin endpoint accepts your account,
with a fix for every failed check.

Without signing in: `curl http://localhost:3000/api/health` returns
`{"status":"ok","mode":"live"}` when the configuration is valid.

## Example: Docker

```bash
cp .env.example .env   # fill it in, or set DEMO_MODE=true to just look around
docker compose up -d
curl http://localhost:3000/api/health
```

or without compose:

```bash
docker run -d -p 127.0.0.1:3000:3000 --env-file .env 365-flow-watcher
```

The compose file publishes the port on `127.0.0.1` only. To expose the app,
put a reverse proxy with HTTPS in front of it (Caddy, Traefik, nginx, Azure
App Service) rather than binding it to `0.0.0.0`.

# Step 1 · Entra app registration

No client secret is needed. The app signs users in and calls Microsoft APIs with their own token.

## Register the app

1. [Entra admin center](https://entra.microsoft.com) → **App registrations** → **New registration**.
2. Name: `365 Flow Watcher` · Account type: **Single tenant**.
3. Redirect URI: platform **Single-page application (SPA)**, value `http://localhost:3000/` (or your `APP_URL` + `/`).
4. **Register**. From **Overview**, copy:

| Field                   | Env variable      |
| ----------------------- | ----------------- |
| Application (client) ID | `AZURE_CLIENT_ID` |
| Directory (tenant) ID   | `AZURE_TENANT_ID` |

More addresses (local + production)? Add each under **Authentication → Single-page application**.

## Add API permissions

**API permissions → Add a permission**, all **Delegated**:

| API                                          | Permissions                                   |
| -------------------------------------------- | --------------------------------------------- |
| Power Automate (_APIs my organization uses_) | `User`, `Flows.Read.All`, `Activity.Read.All` |
| Microsoft Graph                              | `User.Read`, `User.ReadBasic.All`             |
| Microsoft Graph, optional                    | `User.Read.All` (detects **disabled** owners) |

Then **Grant admin consent**.

> Without `User.Read.All` only **deleted** owners are detected as orphans, not disabled ones.

## Limit who can sign in

Entra admin center → **Enterprise applications** → `365 Flow Watcher`:

1. **Properties** → **Assignment required? = Yes** → Save.
2. **Users and groups** → add the people or a security group.

Next: [Step 2 · Power Platform environment](2-environment.md)

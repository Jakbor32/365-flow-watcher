# Configuration reference

Read at runtime, so one Docker image works for any tenant. Setup walkthrough: [docs/setup](setup/1-entra-app.md).

| Variable                        | Required | Default    | Purpose                                                           |
| ------------------------------- | -------- | ---------- | ----------------------------------------------------------------- |
| `DEMO_MODE`                     | no       | `false`    | Fake tenant, no sign-in. Ignores everything below.                |
| `AZURE_TENANT_ID`               | live     |            | Entra tenant ([step 1](setup/1-entra-app.md))                     |
| `AZURE_CLIENT_ID`               | live     |            | App registration ([step 1](setup/1-entra-app.md))                 |
| `APP_URL`                       | live     |            | Public URL, must match the redirect URI                           |
| `POWER_PLATFORM_ENVIRONMENT_ID` | live     |            | Environment to watch ([step 2](setup/2-environment.md))           |
| `WATCHED_FLOW_ACCOUNTS`         | no       | all flows  | Only flows owned by these UPNs                                    |
| `DASHBOARD_USERS`               | no       | anyone     | Who may open the dashboard (on top of Entra assignment)           |
| `ACCESS_MANAGERS`               | no       | nobody     | Who may grant/revoke access and preview other accounts            |
| `PREVIEW_MANAGERS`              | no       | = managers | Who may preview other accounts                                    |
| `ENABLE_GRANT_ACCESS`           | no       | `false`    | Enables grant/revoke. **Writes to your tenant.** Needs a manager. |

Lists: comma separated, case-insensitive, matched against UPN and email.

## Grant access

With `ENABLE_GRANT_ACCESS=true`, managers can add a co-owner (`CanEdit`) or remove one. Both ask for confirmation and are logged with who did what. The primary owner can't be removed.

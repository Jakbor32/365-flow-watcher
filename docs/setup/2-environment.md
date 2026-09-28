# Step 2 · Power Platform environment

## Environment ID → `POWER_PLATFORM_ENVIRONMENT_ID`

Pick one:

- [Power Platform admin center](https://admin.powerplatform.microsoft.com) → **Manage → Environments** → your environment → **Environment ID**.
- [make.powerautomate.com](https://make.powerautomate.com): copy it from the URL, `/environments/<ID>/flows`.
- PowerShell:
  ```powershell
  Install-Module Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser
  Add-PowerAppsAccount
  Get-AdminPowerAppEnvironment | Select-Object DisplayName, EnvironmentName
  ```

The default environment looks like `Default-<tenant ID>`.

## Who can use the dashboard

It reads flows through admin endpoints. Users need one of:

- **Power Platform Administrator** (Entra role), or
- **System Administrator** in that environment.

Next: [Step 3 · Run it](3-run.md)

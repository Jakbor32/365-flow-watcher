# Step 3 · Run it

```bash
cp .env.example .env   # fill in the values from steps 1 and 2
docker compose up -d
curl http://localhost:3000/api/health   # {"status":"ok","mode":"live"}
```

All variables: [configuration.md](../configuration.md).

## Local or public?

| Where                | `APP_URL`                   | Also do                                                                                    |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| Only on your machine | `http://localhost:3000`     | Nothing. Compose binds to `127.0.0.1`.                                                     |
| Reachable by others  | `https://flows.contoso.com` | HTTPS reverse proxy in front, redirect URI added in step 1, **Assignment required = Yes**. |

`http://` is only accepted for `localhost`.

## Why no username/password login?

The app needs a Microsoft token to read flows, so Entra ID is the login. A separate password database would also need a server-side admin secret with access to every flow, and would skip MFA and Conditional Access. More risk, no benefit.

## Something wrong?

- Page shows **"not configured"**: it lists every missing or invalid variable.
- Signed in but no data: open **Diagnostics**, it checks each permission and tells you what to fix.

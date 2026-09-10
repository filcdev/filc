# Entra (Microsoft) OAuth setup

Sign-in via Microsoft Entra ID (formerly Azure Active Directory) is the app's social login provider, backed by better-auth.

## 1. Register an application

Follow only the **Register an application** section of the [Microsoft Entra ID quickstart](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) — sign in with the organization's Microsoft account.

| Field | Value |
| --- | --- |
| Name | `Filc indev` |
| Supported account types | Accounts in this organizational directory only |
| Redirect URI | Web: `http://localhost:3000/api/auth/callback/microsoft` |

After registering, note the **Application (client) ID** and **Directory (tenant) ID** from the overview page.

## 2. Generate a client secret

1. In the app registration, open **Certificates & secrets** → **Client secrets**.
2. **New client secret**, add a description (e.g. "Filc indev secret") and an expiration period.
3. Copy the generated **Value** immediately — it is only shown once.

## 3. Configure environment

Add to `apps/chronos/.env`:

```env
CHRONOS_ENTRA_TENANT_ID=your-tenant-id
CHRONOS_ENTRA_CLIENT_ID=your-client-id
CHRONOS_ENTRA_CLIENT_SECRET=your-client-secret
```

The callback is served by better-auth at `{CHRONOS_BASE_URL}/api/auth/callback/microsoft` — keep the redirect URI in sync with `CHRONOS_BASE_URL`.

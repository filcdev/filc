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

## 4. Preview deployments

Entra does not accept wildcard redirect URIs, and registering one URI per pull
request does not scale (and is capped at 256). Preview deployments therefore
authenticate through the production origin using better-auth's OAuth proxy:

1. Add the production callback to the same app registration, e.g.
   `https://filc.petrik.hu/api/auth/callback/microsoft`. This is the only URI
   Entra needs for previews.
2. Set both of these in every environment that should authenticate:

   ```env
   CHRONOS_OAUTH_PROXY_URL=https://filc.petrik.hu
   CHRONOS_OAUTH_PROXY_SECRET=<openssl rand -base64 32>
   ```

   The URL is the origin Entra knows. The secret must be **identical** in
   production and every preview — it encrypts the profile that travels between
   them — and is separate from `CHRONOS_AUTH_SECRET`, so a leaked preview secret
   cannot forge production sessions. Without both values the plugin is not
   registered and nothing changes.

The flow: the preview redirects to Entra asking for the *production* callback →
production exchanges the code, then redirects the browser to the preview's
`/api/auth/oauth-proxy-callback` with an encrypted profile → the preview
decrypts it and creates the user and session in its own database. Production
never writes preview users, and previews never hold an Entra secret.

Chronos sets the plugin's `currentURL` from `CHRONOS_BASE_URL`, which each
preview container sets to its own hostname; that value is where the profile is
handed back to, so it must be the public HTTPS origin.

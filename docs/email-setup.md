# Notification email setup

Chronos delivers notification email through Microsoft Graph in production and through a local SMTP relay in development. The transports and the templates live in `packages/mail` (`@filcdev/mail`); Chronos owns the pipeline around them.

## 1. Overview

| Transport | Selected by | Used for |
| --- | --- | --- |
| Microsoft Graph | `CHRONOS_MAIL_TRANSPORT=graph` | Production |
| SMTP | `CHRONOS_MAIL_TRANSPORT=smtp` (default) | Local development, against Mailpit |

Graph sends as an application, not as a user. `createGraphTransport` (`packages/mail/src/graph.ts`) mints an app-only token with the client-credentials grant for `https://graph.microsoft.com/.default` (`packages/mail/src/entra.ts`), compiles the message to base64 MIME with nodemailer, and posts it to:

```text
POST https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail
```

The token is cached until 60 seconds before its stated expiry, concurrent sends share one in-flight mint, and a `401` re-mints it once, so a long-running process does not mint one per message. A MIME send always lands in the sending mailbox's **Sent Items**: Microsoft honours `saveToSentItems` only for the JSON body variant, which this transport does not use. Budget the Sent Items for retention and quota accordingly, see §4.

What sends mail: a notification is created, the engine in `apps/chronos/src/utils/notifications/engine.ts` enqueues a delivery job, the in-memory queue (`apps/chronos/src/utils/notifications/queue.ts`) calls `sendEmail` (`apps/chronos/src/utils/notifications/providers/smtp.ts`), and `sendEmail` renders the template from `packages/mail/src/templates` and hands it to the configured transport. Email and push are attempted independently per job, a channel that succeeds is not repeated on a later attempt, and the transport is built on the first send and cached for the process lifetime.

An incomplete Graph configuration does not stop Chronos from starting. The transport is built on the first send, logs one `Graph mail transport not configured, email delivery disabled` warning naming the missing variables, and returns no transport, so the email leg of each job fails while the rest of the app keeps working. Check the log after the first notification, not only at boot.

## 2. Register the Entra application

Create a registration for mail, separate from the sign-in app in [entra-setup.md](entra-setup.md).

| Setting | Value |
| --- | --- |
| Name | `Filc mail` (any name; recipients never see it) |
| Supported account types | Accounts in this organizational directory only (single tenant) |
| Redirect URI | none — this is an app-only client-credentials flow |
| API permissions | Microsoft Graph → **Application permissions** → `Mail.Send` |
| Admin consent | Granted for the tenant |
| Client secret | **Certificates & secrets** → new client secret, expiry 24 months or less |

After registering, copy the **Application (client) ID** and **Directory (tenant) ID** from the overview page. The secret **Value** is shown once, when it is created; Entra never displays it again.

The school tenant already runs this exact permission model for authentik, whose sender is `auth@petrik.hu`. Filc uses its own registration and its own secret: never reuse authentik's client secret, and never add the mail permission to authentik's. The two service principals are independent, so restricting Filc's app to Filc's mailbox does not touch authentik's access.

`CHRONOS_MAIL_ENTRA_*` may be left unset, in which case each value falls back to the sign-in app's `CHRONOS_ENTRA_*` (`apps/chronos/src/utils/environment.ts`). A dedicated registration is still preferable, because it keeps the mail secret separate from the sign-in secret. Set all three values once the mail app exists (§5).

## 3. Restrict the app to the sending mailbox

`Mail.Send` as an application permission is tenant-wide on its own. Exchange Online RBAC for Applications is what narrows it to one mailbox, so the app can send as that mailbox and no other.

```powershell
Connect-ExchangeOnline

$AppId    = '<application-client-id>'         # App registrations → Filc mail → Application (client) ID
$ObjectId = '<service-principal-object-id>'   # Enterprise applications → Filc mail → Object ID
$Mailbox  = 'filc@petrik.hu'                  # the mailbox's primary SMTP address

New-ServicePrincipal -AppId $AppId -ObjectId $ObjectId -DisplayName 'Filc mail'
New-ManagementScope -Name 'Filc mail send' -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$Mailbox'"
New-ManagementRoleAssignment -App $AppId -Role 'Application Mail.Send' -CustomResourceScope 'Filc mail send'
```

`<object-id>` comes from **Enterprise applications**, not from **App registrations**. The two entries describe the same application but carry different object IDs, and an assignment built from the app registration's ID does not cover the app.

If Exchange already knows the service principal (the cmdlet answers that it exists), skip the `New-ServicePrincipal` line and keep the scope and the role assignment.

Allow up to roughly an hour for the assignment to propagate. A `403` immediately after setup is not evidence that something is wrong; retry later before changing the scope, the role or the registration.

Verify with the authorization check rather than by sending mail:

```powershell
Test-ServicePrincipalAuthorization -Identity $AppId -Resource $Mailbox | Format-List
```

`InScope: True` means the `Application Mail.Send` assignment covers that mailbox, and a send from it will be authorized. `InScope: False` means the scope filter, the mailbox address or the role assignment does not match; fix that before touching Chronos.

## 4. The sending mailbox

`From` must be the mailbox's **primary** SMTP address. Graph resolves the sender in the MIME `From` header against the app's `Application Mail.Send` permission, and a proxy address (alias) is not honoured: the send answers `403 ErrorSendAsDenied`. The primary address is the one to put in `CHRONOS_GRAPH_MAILBOX` and in `CHRONOS_SMTP_FROM_EMAIL`; keep the two equal, since the mailbox is what Graph posts to and `CHRONOS_SMTP_FROM_EMAIL` is what the `From` header is compiled from.

```powershell
Get-Mailbox filc@petrik.hu | Select-Object PrimarySmtpAddress
```

A shared mailbox works and needs no licence, which makes it the economical choice for a send-only address. It still needs an Exchange Online mailbox with a primary SMTP address; a licensed user mailbox works the same way.

Every MIME send is filed in that mailbox's **Sent Items**, so plan its retention and quota for notification volume rather than for correspondence: a shared mailbox needs no licence, but its Sent Items grow with every notification unless a retention policy on the folder deletes them. Chronos never reads Sent Items, so a short retention policy is the right default.

If the address you want associated with the sender is `noreply@…`, add it as a proxy address on the sending mailbox rather than using it as `From`:

```powershell
Set-Mailbox filc@petrik.hu -EmailAddresses @{Add = 'smtp:noreply@petrik.hu'}
```

The alias makes mail addressed to `noreply@…` land in the same mailbox, but it is still not a valid `From`, because Graph only honours the primary address. When the visible sender itself must be `noreply@…`, give a dedicated mailbox that address as its primary instead.

## 5. Configure Chronos

| Variable | Default / fallback | Purpose |
| --- | --- | --- |
| `CHRONOS_MAIL_TRANSPORT` | `smtp` | `graph` selects Microsoft Graph; `smtp` selects the nodemailer transport. |
| `CHRONOS_GRAPH_MAILBOX` | `CHRONOS_SMTP_FROM_EMAIL` | The mailbox Graph posts to (`/users/{mailbox}/sendMail`); must be its primary SMTP address. |
| `CHRONOS_MAIL_ENTRA_CLIENT_ID` | `CHRONOS_ENTRA_CLIENT_ID` | Application (client) ID of the mail app. |
| `CHRONOS_MAIL_ENTRA_CLIENT_SECRET` | `CHRONOS_ENTRA_CLIENT_SECRET` | Client secret **value** of the mail app. |
| `CHRONOS_MAIL_ENTRA_TENANT_ID` | `CHRONOS_ENTRA_TENANT_ID` | Directory (tenant) ID the token is minted against. |
| `CHRONOS_SMTP_FROM_EMAIL` | none — required for delivery | `From` address; the mailbox's primary SMTP address. |
| `CHRONOS_SMTP_FROM_NAME` | empty string | Display name in the `From` header. |
| `CHRONOS_BASE_URL` | `http://localhost:3000` in `.env.example` | Public origin of Iris; drives the CTA and the unsubscribe link. |

```env
CHRONOS_MAIL_TRANSPORT=graph
CHRONOS_GRAPH_MAILBOX=filc@petrik.hu
CHRONOS_SMTP_FROM_NAME=Filc
CHRONOS_SMTP_FROM_EMAIL=filc@petrik.hu
CHRONOS_MAIL_ENTRA_CLIENT_ID=00000000-0000-0000-0000-000000000000
CHRONOS_MAIL_ENTRA_CLIENT_SECRET=FILL_ME_IN
CHRONOS_MAIL_ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
CHRONOS_BASE_URL=https://filc.petrik.hu
```

- Under `graph`, the SMTP host, port, user, password and auth mode are not read. Only the two `CHRONOS_SMTP_FROM_*` values (the MIME `From`) and the mailbox fallback are.
- No inbound port, relay container, connector or SMTP AUTH toggle is involved. The container needs outbound HTTPS 443 to `login.microsoftonline.com` (token) and `graph.microsoft.com` (send), nothing else.
- `CHRONOS_BASE_URL` must be the public Iris origin in production. The template's CTA button href is `CHRONOS_BASE_URL`, and the footer's two links are `${CHRONOS_BASE_URL}/unsubscribe?userId=…&token=…` and the authenticated `${CHRONOS_BASE_URL}/settings/notifications?channel=email`, so a `localhost` value ships dead links to real recipients.
- Configuration is read when the process starts and the transport is cached after the first send, so a changed value needs a restart.
- `smtp` is the default, so a production deployment that forgets `CHRONOS_MAIL_TRANSPORT=graph` falls back to SMTP; with no SMTP host set it disables email delivery with a warning instead of sending anything.

## 6. Local development

```bash
docker compose up -d mailpit
```

Mailpit captures everything Chronos sends instead of delivering it: SMTP on `localhost:1025`, every captured message at <http://localhost:8025>, no credentials. SMTP is the default transport, so `CHRONOS_MAIL_TRANSPORT=smtp` only has to be set where the environment was switched to `graph`.

```env
CHRONOS_MAIL_TRANSPORT=smtp
CHRONOS_SMTP_HOST=localhost
CHRONOS_SMTP_PORT=1025
CHRONOS_SMTP_FROM_NAME=Filc
CHRONOS_SMTP_FROM_EMAIL=noreply@filc.hu
```

`CHRONOS_SMTP_SECURE` stays `false`, and `CHRONOS_SMTP_USER` / `CHRONOS_SMTP_PASS` stay empty. Without `CHRONOS_SMTP_HOST` and `CHRONOS_SMTP_FROM_EMAIL`, Chronos disables email delivery and logs a warning rather than failing sends, which is the intended state when running `pg-dispo` without Mailpit.

Three test endpoints preview and send mail. All require a session and are gated by `CHRONOS_ENABLE_TEST_NOTIFICATIONS=true` (default `false`):

| Endpoint | Effect |
| --- | --- |
| `POST /api/notifications/test` | Drops a test notification into the caller's own inbox (in-app only). |
| `POST /api/notifications/test/send` | Sends a real message over email, in-app and/or push to an arbitrary address, through the configured transport — captured by Mailpit locally, sent for real under Graph. |
| `POST /api/notifications/test/preview` | Renders the template and returns the HTML without sending anything. |

Never enable `CHRONOS_ENABLE_TEST_NOTIFICATIONS` in production: `sendTest` accepts any recipient address.

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `403` with `ErrorSendAsDenied` | `From` is not the sending mailbox's primary SMTP address, or the app has no send scope on that mailbox. | Set `CHRONOS_GRAPH_MAILBOX` and `CHRONOS_SMTP_FROM_EMAIL` to the primary address; re-run `Test-ServicePrincipalAuthorization`. |
| `403` with no Graph code, right after setup | RBAC propagation, up to about an hour. | Wait and retry. Do not re-register or widen the scope while `Test-ServicePrincipalAuthorization` already reports `InScope: True`. |
| `401` | The client secret expired or was rotated, or the client/tenant IDs belong to another app. A `401` from `sendMail` is retried once with a freshly minted token before the error surfaces; a `401` from the token endpoint is reported as-is. | Put the new secret value in `CHRONOS_MAIL_ENTRA_CLIENT_SECRET` and restart. |
| `429` | Graph is throttling the mailbox. `Retry-After` is parsed into the error and the queue honours that hint, capped at 60 s; without a usable hint it uses its own backoff (3 attempts maximum). | Nothing for a single burst; a persistent `429` means the mailbox's send volume is too high for it. |
| `202` | Graph accepted the message for delivery. This is not proof that it was delivered. | Confirm with Exchange `Get-MessageTrace`; do not resend from Chronos. |
| Mail stops with no obvious error | The client secret reached its expiry (24 months at most). The token request fails with `Entra token request failed (401)`. | Renew the secret, update the environment, restart. |
| Correct sender, wrong display name | Recipients see `CHRONOS_SMTP_FROM_NAME`, compiled into the MIME `From`; the Entra app name and the mailbox display name play no part. | Set `CHRONOS_SMTP_FROM_NAME`. |
| `Graph sendMail did not complete: …` | The request never got an answer — DNS, TLS, the 30 s per-attempt timeout or an abort. It surfaces as a `GraphMailError` with `status: 0` so a caller switching on the status still sees a number. | Check outbound HTTPS from the host; the queue retries it like any other failure. |

Graph's own `error.code` and message are carried into `GraphMailError` and logged by the `chronos.notifications.smtp` category as `Failed to send email to {to}`. The one `Mail transport created` line at `info` is emitted when the transport is built on the first send and names the transport (and, under Graph, the mailbox), which is the quickest way to tell which configuration a running process actually holds.

## 8. Known limits

- The delivery queue is in memory (`apps/chronos/src/utils/notifications/queue.ts`): concurrency 5, 50 ms between batches, at most 3 attempts with exponential backoff capped at 30 s, and a channel that already succeeded is never repeated. A restart drops whatever is queued, and the dead-letter is a single `warning` log line (`Job … failed after 3 retries, dead-lettering`) naming the channels that did not deliver, not a stored record.
- There is no bounce or NDR ingestion. Graph's `202` ends Chronos' knowledge of the message; a later delivery failure is visible only in Exchange message trace.
- Unsubscribe is a link, not one-click. A send with a user behind it carries `List-Unsubscribe: <$CHRONOS_BASE_URL/unsubscribe?userId=…&token=…>` and deliberately no `List-Unsubscribe-Post`: the handler reads the HMAC from the POST body, so a one-click request would have nothing to verify. Both transports refuse a header name or value containing CR or LF, so the header cannot become header injection. The template footer carries two links, both present only when the send has a user behind it: the authenticated management page (`/settings/notifications?channel=email`, no token) and `/unsubscribe?userId=…&token=…` (an HMAC-SHA-256 of the user id), which turns email off only — the per-type choices stay as the user set them.
- No DKIM or SPF configuration lives in this repository. Sender authentication is the tenant's and the transport's; the repo only asks Graph to send.
- Graph accepts at most 4 MB in a write request's body, and `/sendMail` posts the base64-compiled MIME as that body. `MAX_MIME_BYTES` in `packages/mail/src/graph.ts` refuses a larger message before the request and names the real size, instead of surfacing Graph's `413`.

## 9. Channel defaults by role

Email is the only notification channel a user can switch off. It is resolved per user by `completePreferences` and `applyPreferencesPatch` (`apps/chronos/src/utils/notifications/types.ts`) from the stored `notification_preferences` record plus a role default from `channelDefaultsForUser` (`apps/chronos/src/utils/notifications/channel-defaults.ts`):

- A user linked to a `teacher` row (`teacher.user_id`) gets **email on** by default.
- Everyone else — students, and admins who have no teacher row — gets **email off** by default.
- Push has no user toggle: it is attempted for every notification the user has opted into and is managed separately (a user with no registered device simply gets nothing). In-app rows are always recorded and are likewise managed elsewhere.

A default applies only where the stored record does not name the channel. An explicit user choice always wins, so a student who ticks email in the settings keeps it on, and a teacher who unsubscribes keeps it off.

The same resolution covers accounts that never saved a channel preference. Rows exist from the first settings read, and any row written before the channel split carries no `emailEnabled` key, so a student's pre-existing row now silently resolves to email off and a teacher's to email on, with no data migration. The legacy `channelsEnabled: false` master switch still forces email off, beating the role default.

Announcement email is the one exception to the channel default: it is a separate `announcementEmail` switch that is off by default — including for a stored row written before the key existed — so an announcement is always recorded in-app while the mail leg runs only for users who opted in.

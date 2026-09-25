# FreeRADIUS Architecture & Setup

The FreeRADIUS deployment has been migrated to `apps/radius/` to sit alongside the `chronos` backend and `iris` frontend. The configuration files have been aggressively stripped of unnecessary comments, leaving a concise, production-ready setup compatible with MSCHAPv2, TTLS, and PEAP.

## Directory Structure

```text
apps/radius/
├── docker-compose.yml       # Defines the FreeRADIUS service
├── certs/                   # Contains certificates
└── freeradius/
    ├── clients.conf         # Defines who can connect (NAS setup)
    ├── default              # Outer EAP virtual server routing
    ├── inner-tunnel         # Inner MSCHAPv2/PEAP virtual server
    ├── eap & inner-eap      # TLS and inner EAP mechanisms
    ├── rest                 # Proxies requests to Chronos backend
    └── docker-entrypoint.sh # Permissions and symlink bootstrap
```

## How it Works

1. **Authentication Flow**: Devices connect via WiFi using PEAP/MSCHAPv2. The outer EAP request hits the `default` virtual server. Once TLS negotiation is completed, the inner request is routed to `inner-tunnel`.
2. **REST API (Chronos)**: Instead of connecting directly to the database, FreeRADIUS is configured via the `rest` module to proxy authentication requests to the `chronos` backend over HTTP. Chronos handles password validation, permissions, and accounting.
3. **Docker Network**: The `docker-compose.yml` runs the Alpine-based FreeRADIUS image. In Coolify, you deploy this Docker Compose file and ensure it joins the same Docker network as the `chronos` backend (setting the `connect_uri` in the `rest` file to `http://chronos:3000`).

## Deployment (Coolify & Docker Compose)

When setting up via Coolify or standard Docker Compose:
- Deploy using the provided `docker-compose.yml` under `apps/radius`.
- The system expects the backend to be resolvable at `chronos:3000`. If your backend internal DNS is named differently, update `connect_uri` in `apps/radius/freeradius/rest`.
- FreeRADIUS exposes UDP ports `1812` (auth) and `1813` (acct). You must map these externally on your server so that your Access Points can reach them.


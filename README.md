# chronos

## Development Environment

This project is fully configured to run inside a Dev Container.
When opened in a compatible editor (such as VS Code with the Dev Containers extension), the environment will:

* Install Bun
* Install project dependencies

No local setup required beyond **having Docker (or Docker Desktop) installed**.

## Environment Variables

Before running the application, create a `.env` file in the project root.
Use the format shown below:

```env
CHRONOS_MODE=development
CHRONOS_PORT=3000
CHRONOS_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
CHRONOS_AUTH_SECRET=randomgeneratedsecret
CHRONOS_BASE_URL=http://localhost:3000
CHRONOS_LOG_LEVEL=debug
CHRONOS_ADMIN_EMAIL=your.email.here@petrik.hu
CHRONOS_ENTRA_TENANT_ID=
CHRONOS_ENTRA_CLIENT_ID=
CHRONOS_ENTRA_CLIENT_SECRET=
CHRONOS_MQTT_BROKER_URL=mqtt://127.0.0.1:1883 # optional for now
```

## Running the Project

After opening the repo in the Dev Container and creating your `.env` file, start the development server with:

```bash
bun dev
```
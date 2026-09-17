# Start the Project

## Prerequisites

You need access to the repository [`isc-hei/tisc-editor`](https://github.com/isc-hei/tisc-editor).

If you don't have access, ask **Pierre-André Mudry** to grant it to you.

## Clone the repository

```bash
git clone git@github.com:ISC-HEI/tisc-editor.git
```

## Configuration

You need to configure the `.env` at the root.

More infos on the variables available [here](./configuration).

## Running the project

You can run the project either manually or with Docker.

:::tip[Recommendation]

This project is highly recommended to be started with Docker. It includes volumes, giving you better productivity in dev mode by avoiding the need to rebuild or refresh everything manually.

:::

### Manual setup

The project is split into two parts: the main app and the documentation.

**Main app**

Copy the `.env` at the root:

```bash
cp .env ./app
```

```bash
cd app
bun i
bun run dev
```

The app will be available on port `3000`.

You then need to initialize the WebSocket connection:

```bash
curl http://localhost:3000/api/ws
```

**Documentation (Docusaurus)**

First, you need to edit the configuration to define the base path as `/`, by editing the corresponding variable in `docusaurus.config.ts`.

```bash
cd ../docs
bun i
bun run serve
```

The documentation runs on port `3001`.

### Docker setup

For a development environment with Docker, use:

```bash
docker-compose -f docker-compose-dev.yml up
```

Thanks to the Nginx server behind it, the app is accessible on port `3000`, and the docs are bound to `/docs/`.
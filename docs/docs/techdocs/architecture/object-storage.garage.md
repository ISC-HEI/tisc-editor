# Object Storage (Garage)

The content of project files (source files, images, fonts) is stored in [Garage](https://garagehq.deuxfleurs.fr/), a lightweight S3-compatible object store. PostgreSQL keeps only the metadata and the permissions. This page explains how Garage is set up, how to operate it, and what to do when something goes wrong.

For the data model, see [Database Schema](./database-schema#projectfile). For the place of Garage in the stack, see the [Architecture Overview](./architecture#object-storage).

## Why Garage

Storing images and text files as blobs inside PostgreSQL makes the database, its backups and its memory usage grow with every project. An object store is made for that job, and the application only needs a few operations: write, read, copy and delete objects in a private bucket.

Garage was chosen because:

- it exposes the standard S3 API, so the application does not depend on it (see [Replacing Garage](#replacing-garage));
- it is a single small binary, easy to run as one more container of the stack;
- it is maintained by a non-profit association rather than a company that could change its licence. MinIO, the usual choice for this, is no longer maintained: its repository was archived in April 2026.

Garage implements only a subset of the S3 API. Bucket policies are limited and there is no official web console. This is enough for the editor, which only needs object read, write, copy and delete.

## How it fits in the stack

Garage runs as the `garage` service of the Docker Compose file, on the same internal network as the app.

- The S3 API (port `3900`) is **not published** outside the Docker network. Only the Next.js server talks to it.
- The browser never reads or writes objects directly: every request goes through the server, which checks the user's role in PostgreSQL first. The bucket is private and no pre-signed URL is used.
- The server uses the S3 API through `@aws-sdk/client-s3`, in `src/lib/storage.ts`.

### Key format

Each file is one object:

```
projects/<projectId>/<fileId>
```

`fileId` is the `id` of the matching row in `project_files`, and the full key is stored in its `storage_key` column. Deleting a project removes every object under `projects/<projectId>/`.

The key does not contain the file name, so renaming or moving a file in the editor does not touch the object store.

## Files

| File | Role |
| --- | --- |
| `docker-compose-dev.yml` | Defines the `garage` service and its two volumes |
| `garage/garage.toml` | Garage configuration |
| `scripts/garage-init.sh` | One-time initialization (layout, bucket, access key) |
| `.env` | S3 credentials and Garage secret |

### Compose service

```yaml
garage:
  image: dxflrs/garage:v2.4.1
  container_name: tisc-garage
  environment:
    GARAGE_RPC_SECRET: ${GARAGE_RPC_SECRET}
  expose:
    - "3900"
  volumes:
    - ./garage/garage.toml:/etc/garage.toml:ro
    - garage-meta:/var/lib/garage/meta
    - garage-data:/var/lib/garage/data
```

The image tag is **pinned** on purpose. Do not use `latest`: an automatic update could change the behaviour of the storage without notice. The Garage image contains no shell and no `curl`, so the healthcheck runs the `/garage status` command.

### Configuration

```toml
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"

# Single node: no replication
replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
# rpc_secret is provided by the GARAGE_RPC_SECRET environment variable

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
```

With `replication_factor = 1`, every object exists **once**. There is no redundancy: a lost volume means lost files. See [Backups](#backups).

## Environment variables

| Variable | Description |
| --- | --- |
| `GARAGE_RPC_SECRET` | Internal secret of the node, 64 hexadecimal characters. Read by the `garage` container only |
| `S3_ENDPOINT` | `http://garage:3900` inside the Docker network |
| `S3_REGION` | `garage` (must match `s3_region` in `garage.toml`) |
| `S3_BUCKET` | Name of the bucket, for example `tisc-projects` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_ACCESS_KEY_ID` | `GK` followed by 24 hexadecimal characters |
| `S3_SECRET_ACCESS_KEY` | 64 hexadecimal characters |

The format of the key is imposed by Garage. Generate the values with:

```bash
echo "GARAGE_RPC_SECRET=$(openssl rand -hex 32)"
echo "S3_ACCESS_KEY_ID=GK$(openssl rand -hex 12)"
echo "S3_SECRET_ACCESS_KEY=$(openssl rand -hex 32)"
```

Never commit `.env`. Use a different set of values for each environment.

## First start

Garage needs a one-time initialization: assign a storage layout to the node, create the bucket, and import the access key from `.env`. The script does all three and can safely be run again (it stops if the bucket already exists):

```bash
docker compose -f docker-compose-dev.yml up -d garage
./scripts/garage-init.sh
docker compose -f docker-compose-dev.yml up -d
```

The script only reads the three `S3_*` values it needs from `.env`; it does not execute the file. The storage layout is created with a capacity of 10 GB, which is a limit for Garage's data placement and not a disk reservation: adjust it in the script if you expect more data.

## Migrating existing files

Projects created before Garage was introduced have their content in the `content` column of `project_files`. Both kinds of files are supported at the same time: a file without `storage_key` is read from the database, and is moved to Garage the next time its project is saved.

To move everything at once, run the migration script inside the app container:

```bash
docker compose -f docker-compose-dev.yml exec app bun scripts/migrate-files-to-s3.ts
```

It only handles rows that still have content and no `storage_key`, so it can be interrupted and run again. Once it reports `Done.` and a project can be opened and saved, the `content` column is no longer needed. Dropping it does not free disk space by itself: run `VACUUM FULL project_files;` afterwards.

## Inspecting the storage

Garage has no web interface. The following commands show what it contains.

**Summary of the bucket** (number of objects, size):

```bash
docker compose -f docker-compose-dev.yml exec garage /garage bucket info tisc-projects
```

**List the objects** with the AWS CLI, started temporarily on the Docker network (find the network name with `docker network ls`):

```bash
docker run --rm --network <project>_tisc-network \
  -e AWS_ACCESS_KEY_ID=<S3_ACCESS_KEY_ID> \
  -e AWS_SECRET_ACCESS_KEY=<S3_SECRET_ACCESS_KEY> \
  -e AWS_DEFAULT_REGION=garage \
  amazon/aws-cli --endpoint-url http://garage:3900 \
  s3 ls s3://tisc-projects/ --recursive --human-readable
```

**Read one object**: replace the last line with `s3 cp s3://tisc-projects/projects/<projectId>/<fileId> -`.

Object names are UUIDs. To find which object matches which file, query PostgreSQL:

```sql
SELECT path, mime_type, size, storage_key FROM project_files WHERE project_id = '<project-id>';
```

To check that a migration is complete, compare the number of rows that have a `storage_key` with the object count shown by `bucket info`.

## Backups

Garage keeps its data in two Docker volumes, and a backup must cover both **and** the PostgreSQL database, because rows and objects only make sense together.

| Volume | Content |
| --- | --- |
| `garage-meta` | Garage's internal metadata (which objects exist, where) |
| `garage-data` | The objects themselves |

- Back up the database and both volumes at the same moment, so that the rows do not reference objects that the backup does not contain.
- For the metadata, prefer a consistent snapshot to copying the live files. Garage provides a `garage meta snapshot` command for this; check `garage meta --help` for the exact syntax of the version in use.
- Since there is no replication, test a restore at least once.

## Updating Garage

1. Read the release notes of the new version, especially for a major version change, which can require a migration.
2. Change the image tag in the compose file.
3. Run `docker compose up -d garage`.
4. Check `docker compose logs garage`: Garage refuses to start with an unknown or obsolete option in `garage.toml` and says which one.

For a minor version change (for example `v2.4.1` to `v2.4.2`), changing the tag is enough.

## Replacing Garage

Because the application only uses the S3 API, another S3-compatible store (RustFS, SeaweedFS, a managed service) can replace Garage by changing the `S3_*` variables, after copying the objects to the new bucket with a tool such as `rclone`. The application code does not change.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `garage-init.sh` waits and then prints the container logs | Wrong compose file name (set `COMPOSE_FILE` if it is not `docker-compose-dev.yml`), or Garage failed to start: read the logs it prints |
| Garage exits right after starting | Invalid option in `garage.toml`, or `GARAGE_RPC_SECRET` missing or not 64 hexadecimal characters |
| `Missing environment variable: S3_...` in the app | The variable is missing from `.env`, or the app container was not restarted after the change |
| `Missing S3_BUCKET in .env` from the script | One of the three `S3_*` values the script needs is empty |
| `The "6" variable is not set` when running `docker compose` | A `$` in a value of `.env` is read as a variable: double it (`$$`) or put the value in single quotes |
| A project fails to open, with an error about a missing object | A row points to an object that no longer exists (for example after a restore from different backups). The load fails on purpose, so that a save cannot replace the file with an empty one. Restore the object or delete the row |
| Uploads fail with a checksum error | The S3 client sends checksums that the store does not support. The client is configured to send them only when required; check that `requestChecksumCalculation` is still set to `WHEN_REQUIRED` in `src/lib/storage.ts` |

## Production

The development compose file is not suitable as is for production:

- Keep port `3900` unpublished; only the app container should reach Garage.
- Provide the secrets (`GARAGE_RPC_SECRET`, `S3_SECRET_ACCESS_KEY`) through the deployment environment, not in a file stored in the repository.
- Use new values for the credentials: never reuse the development ones.
- Set up and test the [backups](#backups).
- Size the storage layout capacity according to the disk available for `garage-data`.

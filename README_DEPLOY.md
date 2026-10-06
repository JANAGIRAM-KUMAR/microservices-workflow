# Deployment Guide

Prebuilt image: `janu007/nodejs-microservices` (Docker Hub).

## How the image gets updated

Every push to `main` triggers the GitHub Actions **CD workflow** (`.github/workflows/cd.yml`):

1. Runs typecheck + tests (broken code never reaches Docker Hub)
2. Logs in to Docker Hub using the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` repo secrets
3. Builds and pushes:
   - `janu007/nodejs-microservices:latest` — used by the registry compose below
   - `janu007/nodejs-microservices:<git-sha>` — pinned tag for rollback/traceability

PRs trigger the CI workflow (`ci.yml`) which only runs typecheck + tests.

> Set the two `DOCKERHUB_*` repo secrets (Settings → Secrets and variables → Actions) or the CD job will fail.

## Run on another machine

Only **Docker Desktop** is required — no Node.js or source code needed.

1. Install Docker Desktop and start it.
2. Create a folder, e.g. `nodejs-microservices/`, and copy these from this repo:
   - `docker/docker-compose.registry.yml` (keep the `docker/` subfolder — it reads `.env` from one level above)
   - `sql/` — database migrations
   - `.env` — DB/S3/JWT secrets (from this repo; never commit it)

   Layout:
   ```
   nodejs-microservices/
   ├── docker/
   │   └── docker-compose.registry.yml
   ├── sql/
   └── .env
   ```

3. Start Kafka, run migrations, then start everything:
   ```bash
   docker compose -f docker/docker-compose.registry.yml up -d kafka
   docker compose -f docker/docker-compose.registry.yml run --rm migrate
   docker compose -f docker/docker-compose.registry.yml up -d
   ```

4. Verify the API Gateway: http://localhost:5009/health

## Updating a deployed machine

After a new push to GitHub, pull the fresh image and re-apply migrations:

```bash
docker compose -f docker/docker-compose.registry.yml pull
docker compose -f docker/docker-compose.registry.yml run --rm migrate
docker compose -f docker/docker-compose.registry.yml up -d
```

The `sql/` migrations ship inside the image and the `migrate` service applies them before the app starts, so new schema changes are handled automatically.

## Rollback

Deployments are tagged by git SHA. To run a specific version, override the image:

```bash
docker compose -f docker/docker-compose.registry.yml pull janu007/nodejs-microservices:<sha>
docker compose -f docker/docker-compose.registry.yml up -d --remove-orphans
# then edit the image tag in the compose file to that SHA and re-run `up -d`
```

## Troubleshooting

- The DB is Neon Postgres and must be reachable from the machine's IP — add it to the Neon IP allowlist or use a pooled connection URL.
- `.env` must contain valid S3 credentials and a working `DATABASE_URL`.
- Health endpoints: API Gateway `:5009/health`; Auth/Task/Media/Workflow run internally on 5010–5013; Kafka on `localhost:9092`.
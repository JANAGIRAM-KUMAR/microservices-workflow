# AGENTS.md - Guide for Coding Agents

This file provides instructions for AI coding agents working on this codebase.

## Project Overview

This is a Node.js microservices task management system using TypeScript, Express, PostgreSQL (Neon), Apache Kafka, and S3-compatible storage. It's a monorepo using npm workspaces with 5 services and a shared package.

## Architecture

- **Monorepo**: npm workspaces (`apps/*`, `packages/*`)
- **Services**: api-gateway (5009), auth-service (5010), task-service (5011), media-service (5012), workflow-service (5013)
- **Shared**: `packages/shared` contains common utilities (logger, errors, responses, auth helpers, etc.)
- **Communication**: HTTP between services via Gateway; Kafka for async event-driven communication (task.created → workflow-service)
- **Database**: PostgreSQL with SQL migrations in `sql/` directory
- **Storage**: S3-compatible for file attachments
- **Runtime**: TypeScript with `tsx` (no build step; runs .ts directly)

## Codebase Structure

```
apps/
  api-gateway/      - HTTP proxy, routing, rate limiting, auth middleware
  auth-service/      - User auth, JWT tokens
  task-service/      - Task CRUD, Kafka publisher
  media-service/     - S3 presigned URLs, attachments
  workflow-service/  - Kafka consumer, workflow state
packages/
  shared/            - Common utilities, types, error handlers
docker/
  docker-compose.yml - Full local stack (build from source)
sql/                 - DB migrations (001-004)
scripts/
  migrate.ts         - Migration runner
```

## Development Conventions

### Code Style
- TypeScript, CommonJS modules
- No comments unless explicitly requested (per project instructions)
- Follow existing code patterns in each service
- Use shared utilities from `shared` package when available
- Services load `.env` files (relative paths: `./.env` then `../../.env`)

### Shared Package Usage
Import from `shared`: `import { logger, AppError, errorHandler, successResponse, authenticateToken } from 'shared'`
Check `packages/shared/src/index.ts` for available exports.

### Error Handling
Use `AppError` class and `errorHandler` middleware from shared package. Follow patterns in existing route handlers.

### Database Access
- Use `pg` client (check service dependencies)
- Migrations are idempotent SQL files in `sql/`
- Migration runner: `scripts/migrate.ts` (uses DATABASE_URL)

### Kafka
- Task Service publishes events (task.created) when tasks are created
- Workflow Service consumes events from Kafka
- Broker config: `KAFKA_BROKER` env var (localhost:9092 for local, kafka:29092 in docker)

### Authentication
- JWT tokens (Bearer auth)
- Gateway validates tokens via auth middleware before proxying
- Some internal routes may use `GATEWAY_SECRET` for service-to-service auth

## Running the Project

### With Docker (full stack)
```bash
npm run up              # build and start all + kafka
npm run migrate         # run DB migrations
npm run logs            # tail logs
npm run down            # stop
```

### Development (hot reload)
```bash
npm run kafka:up
npm run dev:gateway
npm run dev:auth
npm run dev:task
npm run dev:media
npm run dev:workflow
```

### Single Service
Each service has `dev` (watch) and `start` (run) scripts. Use `npm run dev -w <service-name>` or the convenience scripts above.

## Key Files to Understand

1. **Dockerfile**: Multi-stage build; installs all deps (including dev for tsx), copies sources. All services share same image.
2. **docker/docker-compose.yml**: Defines full stack; uses build context `..`, overrides env for docker networking (kafka:29092, service URLs use internal hostnames).
3. **packages/shared/src/**: Core utilities - logger (pino), errors, HTTP helpers, middleware (auth, error handler, logging).
4. **apps/api-gateway/src/index.ts**: Proxy setup, middleware (helmet, cors, rate limit, logging), health check.
5. **apps/task-service/src/**: Task CRUD, publishes to Kafka on create.
6. **apps/workflow-service/src/**: Kafka consumer, workflow logic.
7. **scripts/migrate.ts**: Reads SQL files and applies them via pg.

## Testing & Quality

- Test runner: **Vitest** (root config in `vitest.config.ts`, test env in `vitest.setup.ts`)
- Tests live next to source as `*.test.ts` (vitest run collects them from `apps/*/src` and `packages/shared/src`)
- Commands (from repo root):
  - `npm test` — run once
  - `npm run test:watch` — watch mode
  - `npm run test:coverage` — with V8 coverage (output to `coverage/`)
  - `npm run typecheck` — `tsc --noEmit` across all six workspaces
- Each service's `app.ts` exports the Express `app` without listening; `index.ts` configures dotenv, Kafka, and `listen`. Write HTTP tests against `app.ts` via supertest; never import `index.ts` in tests (it binds ports and connects to Kafka)
- Repositories/DB and Kafka are mocked with `vi.mock` at the module level; no live Postgres or Kafka is required to run tests
- `vitest.setup.ts` pins safe test env vars (JWT_SECRET, GATEWAY_SECRET, dummy DATABASE_URL, etc.) so tests never read the real `.env`
- When making changes, verify the service still starts correctly and run `npm run typecheck && npm test`
- `.github/workflows/ci.yml` runs typecheck + tests on push/PR
- For Docker changes, test with `docker compose -f docker/docker-compose.yml build` and `up`
- Health endpoints exist at `/:service/health` (proxied or direct)

## Docker Registry

Prebuilt image published to Docker Hub: `janu007/nodejs-microservices:latest`. Registry compose at `docker/docker-compose.registry.yml` uses this image (no build). See `README_DEPLOY.md`.

## Important Notes

- **Secrets**: `.env` contains secrets; never commit it. It's in `.dockerignore`.
- **No build step**: Services run with `tsx` directly on TypeScript sources.
- **tsx is runtime**: Required in dependencies (not just devDeps) for production image.
- **Database**: External (Neon) - accessible over internet; ensure connectivity.
- **Kafka networking**: In Docker, services connect to `kafka:29092`; locally use `localhost:9092`.



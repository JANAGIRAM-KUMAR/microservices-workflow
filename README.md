# Node.js Microservices Task Management System

A production-ready microservices architecture for task management with user authentication, media attachments, and workflow automation. Built with Node.js, Express, TypeScript, PostgreSQL (Neon), Kafka, and S3-compatible storage.

## Architecture

This application consists of 5 microservices communicating over HTTP and Kafka:

| Service | Port | Purpose |
|---|---|---|
| **API Gateway** | 5009 | Entry point, routing, rate limiting, authentication middleware |
| **Auth Service** | 5010 | User registration, login, JWT token generation/validation |
| **Task Service** | 5011 | Task CRUD operations, task ownership, and publishing events |
| **Media Service** | 5012 | Media uploads, presigned S3 URLs, attachment management |
| **Workflow Service** | 5013 | Event-driven workflow automation consuming Kafka events |

## Tech Stack

- **Runtime**: Node.js 22 + TypeScript (tsx runtime)
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon)
- **Message Queue**: Apache Kafka
- **Storage**: S3-compatible object storage (Neon S3/R2 compatible)
- **Auth**: JWT access tokens
- **Containerization**: Docker & Docker Compose
- **Workspace**: npm workspaces (monorepo)

## Prerequisites

- Node.js 22+
- Docker & Docker Compose (for local Kafka setup)
- PostgreSQL database (or Neon account)
- S3-compatible storage credentials

## Getting Started

### Environment Setup

1. Copy `.env.example` to `.env` (if it exists) or create `.env` with the required variables. Check the existing `.env` for reference:

```env
API_GATEWAY_PORT=5009
AUTH_PORT=5010
TASK_PORT=5011
MEDIA_PORT=5012
WORKFLOW_PORT=5013

AUTH_SERVICE_URL=http://localhost:5010
TASK_SERVICE_URL=http://localhost:5011
MEDIA_SERVICE_URL=http://localhost:5012
WORKFLOW_SERVICE_URL=http://localhost:5013

DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_ACCESS_EXPIRES_IN=1d
GATEWAY_SECRET=...

AWS_ENDPOINT_URL_S3=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
STORAGE_BUCKET=...

KAFKA_BROKER=localhost:9092
LOG_LEVEL=info
```

### Running with Docker Compose (Recommended)

This runs Kafka + all 5 services in containers. The DB and S3 are external (Neon).

```bash
# Build and start everything
npm run up

# Run database migrations
npm run migrate

# Check service status
npm run ps

# View logs
npm run logs

# Stop services
npm run down
```

Or directly:
```bash
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml run --rm migrate
```

### Running Locally (Development)

For local development with hot-reload:

```bash
# Start Kafka first (if not running)
npm run kafka:up

# Run each service in a separate terminal
npm run dev:gateway  # API Gateway
npm run dev:auth     # Auth Service
npm run dev:task     # Task Service
npm run dev:media    # Media Service
npm run dev:workflow # Workflow Service
```

Migrations can be run locally with:
```bash
npm run db:migrate -- sql/001_users.sql
```

## Database Schema

The application uses 4 tables defined in SQL migrations (run in order):

1. **users** (`sql/001_users.sql`) - User accounts with email/password
2. **tasks** (`sql/002_tasks.sql`) - Task records with status, ownership
3. **attachments** (`sql/003_attachments.sql`) - Task attachments linked to S3 objects
4. **workflows** (`sql/004_workflows.sql`) - Workflow definitions/state

## API Endpoints

All requests go through API Gateway at `http://localhost:5009`.

### Auth
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user (requires auth)

### Tasks (requires Bearer token)
- `GET /tasks` - List user's tasks
- `POST /tasks` - Create a new task
- `GET /tasks/:id` - Get a specific task
- `PUT /tasks/:id` - Update a task
- `DELETE /tasks/:id` - Delete a task

### Media (requires Bearer token)
- `POST /tasks/:taskId/attachments` - Get presigned URL for uploading files
- `GET /tasks/:taskId/attachments` - List task attachments
- `DELETE /tasks/:taskId/attachments/:attachmentId` - Delete attachment

### Workflow (requires Bearer token)
- `GET /tasks/:taskId/workflow` - Get workflow state for a task
- `POST /tasks/:taskId/workflow/advance` - Advance workflow

## Event-Driven Architecture

When a task is created, the Task Service publishes an event to Kafka (`task.created`). The Workflow Service consumes this event and initializes workflow state. This demonstrates decoupled microservice communication.

## Security

- JWT-based authentication for protected routes
- Gateway-level authentication middleware
- Rate limiting on API Gateway
- CORS and Helmet security headers
- Secrets managed via environment variables
- .env excluded from Docker build context

## Deployment

To run on another machine see [README_DEPLOY.md](./README_DEPLOY.md) for instructions using the prebuilt Docker image from Docker Hub.

## How to run on your friend's laptop

1. Install Docker Desktop (https://www.docker.com/products/docker-desktop/) and start it.
2. Create a folder (e.g., nodejs-microservices) on their laptop.
3. Copy these files to that folder:
   - docker/docker-compose.registry.yml  (rename to docker-compose.yml or just use -f)
   - .env (the one with DB/S3/JWT secrets from this repo)
   - sql/ folder (contains migration SQL files)
   
   Note: The image is pulled from Docker Hub; they don't need source code or node_modules.

4. From that folder, run migrations and start all services:
   ```bash
   docker compose -f docker/docker-compose.registry.yml up -d
   docker compose -f docker-compose.registry.yml run --rm migrate
   # or if you renamed it to docker-compose.yml in the same dir structure
   ```

   If they put files like this:
   - ./docker-compose.yml (from registry version)
   - ./.env
   - ./sql/*.sql

   Then run from that root:
   ```bash
   docker compose up -d kafka
   docker compose run --rm migrate
   docker compose up -d
   ```

5. Services:
   - API Gateway: http://localhost:5009/health
   - Auth/Task/Media/Workflow run internally on 5010-5013
   - Kafka: localhost:9092

Notes:
- They must have the same .env (DB is Neon Postgres - accessible over internet; S3 bucket keys etc. need to be valid).
- If DB requires IP allowlist, Neon needs to allow their IP or use pooled URL (already configured).
- No need to rebuild locally; docker pull happens automatically on first run.

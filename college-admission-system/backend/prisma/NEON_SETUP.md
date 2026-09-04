# Neon PostgreSQL Connection Setup

This project uses **two** connection strings, per Prisma's recommended Neon setup:

| Env var | Neon connection type | Used for |
|---|---|---|
| `DATABASE_URL` | **Pooled** (PgBouncer, host has `-pooler` suffix) | Application runtime — every Prisma Client query from the running API |
| `DIRECT_URL` | **Direct** (no pooler) | `prisma migrate dev` / `prisma migrate deploy` — schema migrations must bypass the pooler |

## 1. Get both connection strings from Neon

In the Neon console → your project → **Connection Details**:
- Toggle **"Pooled connection"** on → copy that string → `DATABASE_URL`
- Toggle it off → copy the direct string → `DIRECT_URL`

They look like:

```
# Pooled (note the "-pooler" in the host)
DATABASE_URL="postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<dbname>?sslmode=require&pgbouncer=true&connection_limit=1"

# Direct (no "-pooler")
DIRECT_URL="postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/<dbname>?sslmode=require"
```

## 2. Why both are required

- Prisma's query engine opens its own connection pool on top of whatever it's given. Pointing
  that at Neon's pooler with **`pgbouncer=true`** tells Prisma to use PgBouncer-compatible
  prepared-statement handling (PgBouncer in transaction mode doesn't support all of Postgres'
  native prepared statement protocol otherwise).
- `connection_limit=1` on the pooled URL is Neon/Prisma's documented recommendation for
  serverless/edge-style deployments (Render's process model is more traditional long-running,
  but keeping this conservative avoids exhausting Neon's pooler connection slots if you scale
  to multiple Render instances).
- Migrations (`prisma migrate dev/deploy`) need to run DDL and take advisory locks — PgBouncer's
  transaction pooling mode is not safe for this, so `directUrl` in `schema.prisma` routes
  migration commands around the pooler entirely. This is already wired in `schema.prisma`:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```

## 3. `sslmode=require`

Neon requires TLS. Both strings must include `?sslmode=require` (already shown above) —
omitting it causes connection failures, not a silent insecure fallback.

## 4. Applying the schema to your Neon database

Once `backend/.env` has real `DATABASE_URL` / `DIRECT_URL` values:

```bash
cd backend
npm install
npx prisma generate

# Applies the hand-authored migration in prisma/migrations/20260904120000_init
# (Prisma will detect the migrations folder and just run it — no need to
# regenerate it, since it already matches schema.prisma exactly.)
npx prisma migrate deploy

# OR, if you want Prisma to manage migration history interactively / add
# new migrations going forward:
npx prisma migrate dev
```

`prisma migrate dev` will detect the existing `20260904120000_init` migration, see it hasn't
been applied to this fresh database, apply it, and record it in the `_prisma_migrations` table.
From that point on, any further schema changes should go through `prisma migrate dev --name <change>`
to generate new migration files rather than hand-editing `schema.prisma` and re-running `deploy`.

## 5. Render deployment note

On Render, set `DATABASE_URL` and `DIRECT_URL` as environment variables on the Web Service
(Render dashboard → Environment). Run `npx prisma migrate deploy` as part of your Render build
or a one-off pre-deploy command — **not** `migrate dev`, which is interactive and meant for
local development only.

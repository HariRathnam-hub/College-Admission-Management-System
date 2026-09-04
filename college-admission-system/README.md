# College Admission Management System

Monorepo (npm workspaces) containing the `backend` (Express + TypeScript + Prisma)
and `frontend` (Next.js 15 + Tailwind + ShadCN UI).

## Phase 1 — Project Scaffolding ✅

What's included so far:

```
college-admission-system/
├── package.json                # npm workspaces root
├── backend/
│   ├── src/
│   │   ├── config/env.ts       # zod-validated environment config
│   │   ├── config/prisma.ts    # Prisma client singleton
│   │   ├── middlewares/error.middleware.ts
│   │   ├── routes/health.routes.ts
│   │   ├── routes/index.ts
│   │   ├── app.ts              # Express app (helmet, cors, rate-limit, etc.)
│   │   └── server.ts           # HTTP server + graceful shutdown
│   ├── prisma/schema.prisma    # datasource/generator only — models in Phase 2
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/app/layout.tsx
    ├── src/app/page.tsx
    ├── src/app/globals.css     # ShadCN CSS variables (light/dark)
    ├── src/lib/utils.ts        # cn() helper
    ├── components.json         # ShadCN config
    ├── tailwind.config.ts
    ├── next.config.ts
    ├── .env.example
    ├── package.json
    └── tsconfig.json
```

## Getting Started

### 1. Install dependencies (from repo root)
```bash
npm install
```

### 2. Configure environment variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Fill in your Neon `DATABASE_URL`, JWT secrets, Cloudinary, and Resend credentials.

> Note: `backend/src/config/env.ts` strictly validates required vars on boot —
> the server will refuse to start until Cloudinary/Resend/JWT values are present.
> This is intentional for production-readiness; fill in real (or Cloudinary/Resend
> sandbox) values before running the backend.

### 3. Generate Prisma client
```bash
npm run prisma:generate --workspace=backend
```
(Schema currently has no models — Phase 2 adds `User`, `Application`, etc., then
you'll run `npm run prisma:migrate --workspace=backend`.)

### 4. Run dev servers
```bash
npm run dev:backend    # http://localhost:5000/api/v1/health
npm run dev:frontend   # http://localhost:3000
```

### 5. Install ShadCN components (as needed, inside frontend/)
```bash
cd frontend
npx shadcn@latest add button input label form card
```

## Phase Roadmap
1. ✅ Project Scaffolding & Architecture
2. Database Schema (Prisma models + migrations)
3. Auth System — Backend (JWT + refresh tokens, RBAC, email verification, password reset)
4. Auth System — Frontend
5. Student Application Flow
6. Admin Management
7. Analytics Dashboard
8. Deployment (Vercel + Render)

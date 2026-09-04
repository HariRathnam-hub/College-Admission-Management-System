# College Admission Management System — Phase 1: Architecture & Planning

> Scope: architecture, data modeling, and planning only. No controllers, services, hooks, or UI implementation code.

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                            │
│   Next.js 15 (App Router) + Tailwind CSS + ShadCN UI                 │
│   Hosted on Vercel                                                   │
│   - Student Portal (apply, track status, upload documents)           │
│   - Admin Portal (review applications, manage programs, analytics)   │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTPS (REST, JSON)
                                 │ Access token: Authorization header
                                 │ Refresh token: httpOnly secure cookie
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              API LAYER                               │
│   Node.js + Express.js (TypeScript)                                  │
│   Hosted on Render                                                   │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────────────────┐  │
│   │ Auth Module   │ │ RBAC Middleware│ │ Rate Limiting / Helmet    │  │
│   │ (JWT + bcrypt)│ │ (ADMIN/STUDENT)│ │ / CORS / Validation (Zod) │  │
│   └───────────────┘ └───────────────┘ └───────────────────────────┘  │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────────────────┐  │
│   │ Applications  │ │ Documents     │ │ Analytics Aggregation      │  │
│   │ Module        │ │ Module        │ │ Module                     │  │
│   └───────────────┘ └───────────────┘ └───────────────────────────┘  │
└──────┬───────────────────┬────────────────────────┬───────────────────┘
       │ Prisma ORM         │ Signed upload/API      │ Transactional email
       ▼                    ▼                        ▼
┌─────────────┐     ┌───────────────┐        ┌───────────────┐
│ PostgreSQL   │     │ Cloudinary     │        │ Resend         │
│ (Neon)       │     │ (file storage) │        │ (email service)│
│ Serverless,  │     │ - ID docs      │        │ - Verification │
│ branchable   │     │ - Transcripts  │        │ - Password     │
│              │     │ - Photos       │        │   reset        │
└─────────────┘     └───────────────┘        └───────────────┘
```

### 1.2 Component Responsibilities

| Layer | Responsibility |
|---|---|
| **Next.js Frontend** | Route-based UI (student/admin), form handling + client-side validation (Zod + react-hook-form), calling REST API via a typed API client, storing access token in memory (not localStorage), silent refresh via httpOnly cookie. |
| **Express API** | Stateless REST API; issues/validates JWTs; enforces RBAC; validates all input server-side (Zod); orchestrates Prisma, Cloudinary, and Resend; central error handling. |
| **PostgreSQL (Neon)** | System of record. Relational integrity for users, applications, documents, tokens. |
| **Prisma** | Type-safe DB access layer + migration tooling. |
| **Cloudinary** | Stores uploaded documents/photos; API returns only secure URLs + public IDs, never raw files, to the DB. |
| **Resend** | Transactional email: verification links, password reset links, application status notifications. |

### 1.3 Authentication & Session Flow (Architecture-Level)

1. **Signup** → password hashed with bcrypt → user created as `STUDENT` (default) → verification email sent via Resend (token stored, TTL-bound).
2. **Login** → credentials verified → short-lived **access token** (JWT, ~15 min) returned in response body → long-lived **refresh token** (JWT, ~7 days) set as httpOnly, secure, `SameSite=strict` cookie → refresh token also persisted (hashed) in DB for revocation support.
3. **Authenticated requests** → `Authorization: Bearer <access_token>` header → validated by auth middleware → RBAC middleware checks role claim against route requirement.
4. **Token refresh** → frontend calls `/auth/refresh` when access token expires → refresh cookie validated against DB record → new access token issued → refresh token rotated (old one invalidated) to mitigate replay.
5. **Logout** → refresh token record deleted/revoked in DB → cookie cleared.
6. **Password reset** → time-boxed single-use token emailed → on use, all existing refresh tokens for that user are revoked (force re-login everywhere).

### 1.3.1 Cross-Site Cookie & CORS Design (Vercel ↔ Render)

The frontend (`*.vercel.app` / custom domain) and backend (`*.onrender.com` / custom domain)
are **different origins**, so this is a cross-site deployment. That changes the cookie and
CORS requirements from a same-site default:

- **Refresh token cookie attributes (production):**
  - `httpOnly: true` — never readable by JS, mitigates XSS token theft
  - `secure: true` — required in production; sent only over HTTPS
  - `sameSite: "none"` — **required** for cross-site requests (Vercel → Render); `strict` or
    `lax` would silently block the cookie from ever being sent back, breaking refresh/logout
  - `sameSite: "none"` **only works when `secure: true`** — browsers reject `None` cookies over
    plain HTTP, so local dev (`http://localhost`) needs an environment-conditional cookie config
    (`sameSite: "lax", secure: false` in development; `sameSite: "none", secure: true` in production)
  - `path: "/api/v1/auth"` — scope the cookie narrowly rather than the whole domain
  - `maxAge` matching `JWT_REFRESH_EXPIRES_IN`

- **CORS configuration (backend):**
  - `credentials: true` — required for the browser to send/receive the httpOnly cookie
  - `origin` — **must be an explicit allow-list, never `*`** (wildcard origin is incompatible
    with `credentials: true` per the CORS spec, and is a security hole regardless). Allow-list:
    - Production frontend domain (e.g. `https://admissions.example.com`)
    - Vercel preview deployment pattern, if preview testing against the live API is needed
      (e.g. matched via a regex against `*.vercel.app` — only enable this deliberately, since
      it widens the trusted origin set)
    - `http://localhost:3000` in development only
  - Reflect the allow-listed origin dynamically (not a static single string) so multiple
    trusted origins can coexist, but **never reflect an arbitrary incoming `Origin` header** —
    the check must be against the explicit allow-list.

- **Frontend fetch/axios config:** every request that needs the refresh cookie must set
  `credentials: "include"` (fetch) or `withCredentials: true` (axios) — otherwise the browser
  won't attach the cookie even with correct backend headers.

This is a deployment-critical detail: getting `SameSite`/CORS wrong here is the single most
common reason a working-locally auth flow breaks silently in production (refresh/logout calls
appear to succeed but the cookie never round-trips).

### 1.4 Authorization Boundary — Backend Is the Only Enforcement Point

Next.js `middleware.ts` (listed in the folder structure below) runs at the edge and can only
inspect what's available there — cookies and headers, not the in-memory access token held by
the React app. Since the access token deliberately lives in memory (not a cookie, to reduce
XSS/CSRF surface), **Next.js middleware cannot verify it** and must not be treated as a security
boundary. Its role is limited to UX: e.g. redirecting an obviously-logged-out user away from
`/dashboard` before a flash of protected UI, based on a lightweight signal (such as presence of
the refresh cookie), not the access token itself.

The **only** real enforcement point is the backend: `authMiddleware` (verifies the JWT access
token signature/expiry) and `rbacMiddleware` (checks the role claim) on every protected Express
route. Every controller must assume a request could arrive without having passed through any
frontend guard, and authorize accordingly. This also means resource ownership checks (e.g. "is
this application row actually this student's?") happen in the service layer against `req.user.id`,
never inferred from client-supplied data.

### 1.5 Deployment Topology

| Concern | Frontend (Vercel) | Backend (Render) |
|---|---|---|
| Build | `next build` | `tsc` → `dist/` |
| Runtime | Vercel Edge/Node runtime | Node.js (Render Web Service) |
| Env vars | `NEXT_PUBLIC_API_URL`, etc. | DB, JWT secrets, Cloudinary, Resend |
| Scaling | Automatic (Vercel) | Render autoscale / manual instance sizing |
| DB connection | N/A (via API only) | Neon pooled connection (`DATABASE_URL`) + direct (`DIRECT_URL` for migrations) |
| CORS | — | Restricted to Vercel production + preview domains |

---

## 2. Complete Folder Structure

This is the **target structure across all phases** (not all files exist yet — Phase 1 scaffolding created the skeleton; later phases populate modules).

```
college-admission-system/
├── package.json                          # npm workspaces root
├── README.md
├── docs/
│   └── PHASE_1_ARCHITECTURE.md
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── server.ts                     # HTTP bootstrap
│       ├── app.ts                        # Express app config
│       ├── config/
│       │   ├── env.ts                    # validated env vars
│       │   ├── prisma.ts                 # Prisma client singleton
│       │   ├── cloudinary.ts             # Cloudinary SDK config
│       │   └── resend.ts                 # Resend SDK config
│       ├── routes/
│       │   ├── index.ts                  # route aggregator
│       │   ├── health.routes.ts
│       │   ├── auth.routes.ts
│       │   ├── student.routes.ts
│       │   ├── program.routes.ts         # public/student-facing GET /programs
│       │   ├── application.routes.ts
│       │   ├── document.routes.ts
│       │   ├── notification.routes.ts
│       │   ├── admin.routes.ts           # mounts admin sub-routers below
│       │   ├── admin/
│       │   │   ├── admin.applications.routes.ts
│       │   │   ├── admin.documents.routes.ts   # review endpoint
│       │   │   ├── admin.programs.routes.ts
│       │   │   └── admin.students.routes.ts
│       │   └── analytics.routes.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── student.controller.ts
│       │   ├── program.controller.ts
│       │   ├── application.controller.ts
│       │   ├── document.controller.ts
│       │   ├── notification.controller.ts
│       │   ├── admin.controller.ts
│       │   └── analytics.controller.ts
│       ├── services/                     # business logic, DB orchestration
│       │   ├── auth.service.ts
│       │   ├── token.service.ts          # JWT sign/verify/rotate
│       │   ├── email.service.ts          # Resend wrappers
│       │   ├── upload.service.ts         # Cloudinary wrappers
│       │   ├── application.service.ts
│       │   ├── document.service.ts       # includes review workflow
│       │   ├── notification.service.ts   # creates rows at status/review events
│       │   ├── program.service.ts
│       │   └── analytics.service.ts
│       ├── middlewares/
│       │   ├── auth.middleware.ts        # verify access token
│       │   ├── rbac.middleware.ts        # role guard (ADMIN/STUDENT)
│       │   ├── validate.middleware.ts    # Zod schema validation
│       │   ├── upload.middleware.ts      # multer config
│       │   ├── rateLimit.middleware.ts
│       │   └── error.middleware.ts
│       ├── validators/                   # Zod request schemas
│       │   ├── auth.validators.ts
│       │   ├── application.validators.ts
│       │   └── admin.validators.ts
│       ├── types/
│       │   ├── express.d.ts              # req.user augmentation
│       │   └── jwt.types.ts
│       └── utils/
│           ├── AppError.ts
│           ├── asyncHandler.ts
│           ├── password.ts               # bcrypt helpers
│           └── tokenGenerator.ts         # secure random tokens
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── components.json
    ├── .env.example
    ├── public/
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx                  # landing page
        │   ├── globals.css
        │   ├── (auth)/
        │   │   ├── login/page.tsx
        │   │   ├── signup/page.tsx
        │   │   ├── verify-email/page.tsx
        │   │   ├── forgot-password/page.tsx
        │   │   └── reset-password/page.tsx
        │   ├── (student)/
        │   │   ├── dashboard/page.tsx
        │   │   ├── application/page.tsx
        │   │   ├── documents/page.tsx
        │   │   └── profile/page.tsx
        │   └── (admin)/
        │       ├── dashboard/page.tsx
        │       ├── applications/page.tsx
        │       ├── applications/[id]/page.tsx
        │       ├── programs/page.tsx
        │       ├── students/page.tsx
        │       └── analytics/page.tsx
        ├── components/
        │   ├── ui/                       # ShadCN primitives
        │   ├── layout/                   # navbar, sidebar, shells
        │   ├── auth/
        │   ├── student/
        │   ├── admin/
        │   └── analytics/                # charts
        ├── lib/
        │   ├── api-client.ts             # axios instance + interceptors
        │   ├── utils.ts                  # cn()
        │   └── constants.ts
        ├── hooks/
        │   ├── useAuth.ts
        │   ├── useUser.ts
        │   └── useApplications.ts
        ├── context/
        │   └── AuthContext.tsx
        ├── types/
        │   ├── user.ts
        │   ├── application.ts
        │   └── api.ts
        └── middleware.ts                 # Next.js route protection
```

---

## 3. PostgreSQL Database Design

### 3.1 Entity-Relationship Overview

```
User (1) ──────────< RefreshToken (many)
User (1) ──────────< EmailVerificationToken (many, latest active)
User (1) ──────────< PasswordResetToken (many, latest active)
User (1) ──1:1────── StudentProfile (nullable — only for STUDENT role)
StudentProfile (1) ─< Application (many)
Program (1) ────────< Application (many)
Application (1) ────< Document (many)
Application (1) ────< ApplicationStatusHistory (many)
User (1) ──────────< Notification (many, recipient)
User (1) ──────────< Document (many, as reviewer — reviewedById, nullable)
```

### 3.2 Core Tables

**users**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| email | varchar(255) | unique, not null |
| password_hash | varchar(255) | not null |
| role | enum(ADMIN, STUDENT) | not null, default STUDENT |
| is_email_verified | boolean | not null, default false |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-update |

**student_profiles**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, unique, not null |
| first_name | varchar(100) | not null |
| last_name | varchar(100) | not null |
| phone | varchar(20) | nullable |
| date_of_birth | **date** (Postgres `DATE`, no time component) | nullable |
| address | text | nullable |
| created_at / updated_at | timestamptz | |

**programs**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(150) | not null |
| department | varchar(150) | not null |
| description | text | nullable |
| duration | varchar(50) | nullable (e.g. "4 years", "18 months") |
| fees | numeric(10,2) | nullable |
| application_deadline | timestamptz | nullable |
| seats_available | int | not null, default 0 |
| is_active | boolean | default true — **only `is_active = true` programs are visible via public/student endpoints** |
| created_at / updated_at | timestamptz | |

**applications**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| student_id | uuid | FK → student_profiles.id, not null |
| program_id | uuid | FK → programs.id, not null |
| status | enum(DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, WAITLISTED) | default DRAFT |
| submitted_at | timestamptz | nullable |
| decision_at | timestamptz | nullable |
| decision_note | text | nullable |
| created_at / updated_at | timestamptz | |

Indexes: `(student_id)`, `(program_id)`, `(status)`; unique `(student_id, program_id)` if one application per program per student is a business rule.

**documents**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| application_id | uuid | FK → applications.id, not null |
| type | enum(TRANSCRIPT, ID_PROOF, PHOTO, RECOMMENDATION_LETTER, OTHER) | not null |
| cloudinary_public_id | varchar(255) | not null |
| secure_url | text | not null |
| file_name | varchar(255) | not null |
| file_size_bytes | int | nullable |
| status | enum(PENDING, VERIFIED, REJECTED) | not null, default PENDING |
| review_note | text | nullable |
| reviewed_at | timestamptz | nullable |
| reviewed_by_id | uuid | FK → users.id, nullable (set when an admin reviews) |
| uploaded_at | timestamptz | default now() |

Indexes: `(application_id)`, `(status)`.

**notifications**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, not null — recipient |
| type | enum(APPLICATION_STATUS_CHANGE, DOCUMENT_REVIEWED, GENERAL) | not null |
| title | varchar(200) | not null |
| message | text | not null |
| related_application_id | uuid | FK → applications.id, nullable |
| is_read | boolean | not null, default false |
| created_at | timestamptz | default now() |

Indexes: `(user_id, is_read)` for the common "unread notifications for this user" query.

**application_status_history**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| application_id | uuid | FK → applications.id, not null |
| from_status | enum | nullable |
| to_status | enum | not null |
| changed_by_user_id | uuid | FK → users.id, not null |
| note | text | nullable |
| created_at | timestamptz | default now() |

**refresh_tokens**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, not null |
| token_hash | varchar(255) | not null, unique |
| expires_at | timestamptz | not null |
| revoked_at | timestamptz | nullable |
| created_at | timestamptz | default now() |

Indexes: `(user_id)`, `(token_hash)`.

**email_verification_tokens** / **password_reset_tokens**
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, not null |
| token_hash | varchar(255) | not null, unique |
| expires_at | timestamptz | not null |
| used_at | timestamptz | nullable |
| created_at | timestamptz | default now() |

### 3.3 Design Notes
- All tokens (refresh, verification, reset) are stored **hashed**, never in plaintext — mirrors password storage discipline.
- `application_status_history` gives the analytics module a time-series to compute funnel/conversion metrics without recomputation hacks.
- Soft-delete is intentionally **not** used for `applications`/`users` in v1 — deletion is out of scope; `is_active` flags cover the one legitimate case (`programs`).
- UUID primary keys (not serial ints) to avoid enumeration and to simplify Neon branching/seeding across environments.
- **Single `users` table with a `role` enum** — no separate `admins` table. An admin is just a `User` with `role = ADMIN` and no `StudentProfile` row. This keeps auth (login/refresh/reset) identical for both roles and avoids duplicating credential-handling logic; role-specific data (e.g. `StudentProfile`) is attached via an optional 1:1 relation instead.
- **`notifications` is written server-side**, not computed on read — the service layer inserts a row at the moments that matter (application status change via `application_status_history` write, document review) so the frontend can cheaply poll/fetch `unread` counts without recomputing from other tables.
- **`documents.reviewed_by_id`** is a second FK to `users` (distinct from `application_status_history.changed_by_user_id`), scoped to document-level verification rather than application-level decisions — a document can be `REJECTED` (e.g. blurry scan) without the application itself being rejected.

---

## 4. Prisma Schema (Design — Revised per Phase 1 approval notes)

> Changes from the first draft: added `Notification` model; added `DocumentStatus` enum +
> review fields on `Document`; `StudentProfile.dateOfBirth` now `@db.Date`; `Program` gained
> `duration`, `fees`, `applicationDeadline`; single `User` + `Role` retained (no `Admin` table).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  ADMIN
  STUDENT
}

enum ApplicationStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  WAITLISTED
}

enum DocumentType {
  TRANSCRIPT
  ID_PROOF
  PHOTO
  RECOMMENDATION_LETTER
  OTHER
}

enum DocumentStatus {
  PENDING
  VERIFIED
  REJECTED
}

enum NotificationType {
  APPLICATION_STATUS_CHANGE
  DOCUMENT_REVIEWED
  GENERAL
}

model User {
  id                      String                     @id @default(uuid())
  email                   String                     @unique
  passwordHash            String                     @map("password_hash")
  role                    Role                       @default(STUDENT)
  isEmailVerified         Boolean                    @default(false) @map("is_email_verified")
  createdAt               DateTime                   @default(now()) @map("created_at")
  updatedAt               DateTime                   @updatedAt @map("updated_at")

  studentProfile          StudentProfile?
  refreshTokens           RefreshToken[]
  emailVerificationTokens EmailVerificationToken[]
  passwordResetTokens     PasswordResetToken[]
  statusChangesMade       ApplicationStatusHistory[] @relation("ChangedBy")
  documentsReviewed       Document[]                 @relation("DocumentReviewedBy")
  notifications           Notification[]

  @@map("users")
}

model StudentProfile {
  id            String        @id @default(uuid())
  userId        String        @unique @map("user_id")
  firstName     String        @map("first_name")
  lastName      String        @map("last_name")
  phone         String?
  dateOfBirth   DateTime?     @map("date_of_birth") @db.Date
  address       String?
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  applications  Application[]

  @@map("student_profiles")
}

model Program {
  id                  String        @id @default(uuid())
  name                String
  department          String
  description         String?
  duration            String?
  fees                Decimal?      @db.Decimal(10, 2)
  applicationDeadline DateTime?     @map("application_deadline")
  seatsAvailable      Int           @default(0) @map("seats_available")
  isActive            Boolean       @default(true) @map("is_active")
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  applications        Application[]

  @@index([isActive])
  @@map("programs")
}

model Application {
  id             String                     @id @default(uuid())
  studentId      String                     @map("student_id")
  programId      String                     @map("program_id")
  status         ApplicationStatus          @default(DRAFT)
  submittedAt    DateTime?                  @map("submitted_at")
  decisionAt     DateTime?                  @map("decision_at")
  decisionNote   String?                    @map("decision_note")
  createdAt      DateTime                   @default(now()) @map("created_at")
  updatedAt      DateTime                   @updatedAt @map("updated_at")

  student        StudentProfile             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  program        Program                    @relation(fields: [programId], references: [id])
  documents      Document[]
  statusHistory  ApplicationStatusHistory[]
  notifications  Notification[]

  @@unique([studentId, programId])
  @@index([status])
  @@map("applications")
}

model Document {
  id                  String         @id @default(uuid())
  applicationId       String         @map("application_id")
  type                DocumentType
  cloudinaryPublicId  String         @map("cloudinary_public_id")
  secureUrl           String         @map("secure_url")
  fileName            String         @map("file_name")
  fileSizeBytes       Int?           @map("file_size_bytes")
  status              DocumentStatus @default(PENDING)
  reviewNote          String?        @map("review_note")
  reviewedAt          DateTime?      @map("reviewed_at")
  reviewedById        String?        @map("reviewed_by_id")
  uploadedAt          DateTime       @default(now()) @map("uploaded_at")

  application         Application    @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  reviewedBy          User?          @relation("DocumentReviewedBy", fields: [reviewedById], references: [id])

  @@index([applicationId])
  @@index([status])
  @@map("documents")
}

model ApplicationStatusHistory {
  id               String             @id @default(uuid())
  applicationId    String             @map("application_id")
  fromStatus       ApplicationStatus? @map("from_status")
  toStatus         ApplicationStatus  @map("to_status")
  changedByUserId  String             @map("changed_by_user_id")
  note             String?
  createdAt        DateTime           @default(now()) @map("created_at")

  application      Application        @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  changedBy        User               @relation("ChangedBy", fields: [changedByUserId], references: [id])

  @@index([applicationId])
  @@map("application_status_history")
}

model Notification {
  id                    String            @id @default(uuid())
  userId                String            @map("user_id")
  type                  NotificationType
  title                 String
  message               String
  relatedApplicationId  String?           @map("related_application_id")
  isRead                Boolean           @default(false) @map("is_read")
  createdAt             DateTime          @default(now()) @map("created_at")

  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  relatedApplication    Application?      @relation(fields: [relatedApplicationId], references: [id], onDelete: SetNull)

  @@index([userId, isRead])
  @@map("notifications")
}

model RefreshToken {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  tokenHash  String    @unique @map("token_hash")
  expiresAt  DateTime  @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model EmailVerificationToken {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  tokenHash  String    @unique @map("token_hash")
  expiresAt  DateTime  @map("expires_at")
  usedAt     DateTime? @map("used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("email_verification_tokens")
}

model PasswordResetToken {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  tokenHash  String    @unique @map("token_hash")
  expiresAt  DateTime  @map("expires_at")
  usedAt     DateTime? @map("used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_reset_tokens")
}
```

**Notes on the changes:**
- `Document.reviewedById` is **nullable and optional-relation** (`User?`) since a freshly
  uploaded document has no reviewer yet.
- `Notification.relatedApplicationId` uses `onDelete: SetNull` (not `Cascade`) — if an
  application were ever removed, historical notifications shouldn't vanish, just lose the link.
- `Program.fees` uses `Decimal @db.Decimal(10,2)` rather than `Float`, to avoid floating-point
  rounding issues with currency.
- `StudentProfile.dateOfBirth` is `DateTime @db.Date` — Prisma models it as `DateTime` in the
  generated client (time component will be zeroed), but the underlying Postgres column is a
  true `DATE`, matching the DB design table above.

---

## 5. API Architecture

### 5.1 Conventions
- **Base path:** `/api/v1`
- **Format:** JSON in/out; `Content-Type: application/json` (multipart for uploads)
- **Auth:** `Authorization: Bearer <accessToken>` header; refresh token travels only via httpOnly cookie, never in JS-readable storage
- **Response envelope:**
  ```json
  { "success": true, "data": { ... }, "message": "optional" }
  { "success": false, "message": "...", "errors": { "field": ["..."] } }
  ```
- **Pagination:** `?page=1&limit=20` → `{ data: [...], meta: { page, limit, total, totalPages } }`
- **Versioning:** path-based (`/api/v1`), allows a future `/api/v2` without breaking clients.

### 5.2 Endpoint Map

**Auth** (`/api/v1/auth`) — public unless noted
- `POST /signup`
- `POST /login`
- `POST /refresh`
- `POST /logout` (auth required)
- `GET /verify-email/:token`
- `POST /resend-verification`
- `POST /forgot-password`
- `POST /reset-password/:token`
- `GET /me` (auth required)

**Programs — public/student-facing** (`/api/v1/programs`) — no auth required
- `GET /` — list programs; **service layer always filters `is_active = true`** for this
  unauthenticated route (admin sees inactive programs only via `/admin/programs`)
- `GET /:id` — single program detail; returns 404 if inactive (does not leak existence of
  inactive programs to unauthenticated/student callers)

**Students** (`/api/v1/students`) — role: STUDENT
- `GET /me/profile`
- `PATCH /me/profile`

**Notifications** (`/api/v1/notifications`) — auth required (own notifications only)
- `GET /` (paginated, filterable by `isRead`)
- `PATCH /:id/read`
- `PATCH /read-all`

**Applications** (`/api/v1/applications`) — role: STUDENT (own records only, enforced server-side)
- `GET /` (student's own applications)
- `POST /` (create draft for a program)
- `GET /:id`
- `PATCH /:id` (only while DRAFT)
- `POST /:id/submit`

**Documents** (`/api/v1/applications/:applicationId/documents`) — role: STUDENT (own application)
- `POST /` (multipart upload → Cloudinary → row insert, `status = PENDING`)
- `GET /`
- `DELETE /:documentId`

**Document Review** (`/api/v1/admin/documents/:documentId/review`) — role: ADMIN
- `PATCH /` — sets `status` (`VERIFIED`/`REJECTED`), `reviewNote`, `reviewedAt`, `reviewedById`;
  triggers a `Notification` to the student

**Admin** (`/api/v1/admin`) — role: ADMIN
- `GET /applications` (filter by status/program, paginated)
- `GET /applications/:id`
- `PATCH /applications/:id/status` (writes `application_status_history`)
- `GET /students`
- `GET /students/:id`
- `POST /programs`
- `PATCH /programs/:id`
- `GET /programs`

**Analytics** (`/api/v1/analytics`) — role: ADMIN
- `GET /overview` (totals: applications, by status, by program)
- `GET /trends` (time-series submissions/decisions)
- `GET /programs/:id/stats`

**System**
- `GET /health` — public, no auth

### 5.3 Middleware Pipeline (per request)
```
helmet → cors → rateLimit → json/urlencoded parser → cookieParser → morgan
   → [route match]
   → authMiddleware (if protected)      → verifies access JWT, attaches req.user
   → rbacMiddleware(...allowedRoles)    → 403 if role mismatch
   → validateMiddleware(zodSchema)      → 422 on bad payload
   → controller → service → Prisma
   → errorMiddleware (catches everything, including async via express-async-errors)
```

### 5.4 Error Handling Contract
| Status | Meaning |
|---|---|
| 400 | Malformed request |
| 401 | Missing/invalid/expired access token |
| 403 | Authenticated but wrong role, or resource not owned by requester |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate application for same program) |
| 422 | Validation failure (Zod) — includes field-level `errors` |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error |

---

## 6. Required npm Packages

### 6.1 Backend
| Package | Purpose |
|---|---|
| `express` | HTTP server/routing |
| `@prisma/client`, `prisma` | ORM + migrations |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | Access/refresh JWT sign & verify |
| `zod` | Runtime schema validation (env + requests) |
| `cors` | Cross-origin config for Vercel frontend |
| `helmet` | Security headers |
| `express-rate-limit` | Brute-force/DoS mitigation |
| `cookie-parser` | Read httpOnly refresh cookie |
| `morgan` | Request logging |
| `multer` | Multipart form-data handling (file uploads) |
| `cloudinary` | File storage SDK |
| `resend` | Transactional email SDK |
| `dotenv` | Env var loading |
| `express-async-errors` | Auto-forward async errors to error middleware |
| **Dev:** `typescript`, `tsx`, `tsc-alias`, `@types/*` | TS tooling + type defs |

### 6.2 Frontend
| Package | Purpose |
|---|---|
| `next`, `react`, `react-dom` | Framework |
| `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate` | Styling |
| ShadCN UI (generated via CLI, not a single package) — `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | UI primitives + icons |
| `react-hook-form`, `@hookform/resolvers`, `zod` | Form state + validation (shared schemas with backend intent) |
| `axios` | API client with interceptors (attach token, handle 401 → refresh) |
| `@tanstack/react-query` | Server-state caching, refetching, optimistic updates |
| `recharts` (added in Phase 7) | Analytics charts |
| **Dev:** `typescript`, `@types/react`, `@types/node`, `eslint`, `eslint-config-next` | Tooling |

---

## 7. Development Roadmap

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Architecture, folder structure, DB design, Prisma schema, API design, package plan *(this document)* | — |
| 2 | Prisma schema implementation + migrations against Neon | Phase 1 |
| 3 | Backend auth: signup/login, bcrypt, JWT access+refresh, rotation, RBAC middleware, email verification, password reset | Phase 2 |
| 4 | Frontend auth: login/signup/verify/reset pages, AuthContext, axios interceptors, Next.js middleware route guards | Phase 3 |
| 5 | Student flow: profile, program browsing, application CRUD, Cloudinary document upload | Phase 3, 4 |
| 6 | Admin flow: application review/decision, program management, student directory | Phase 3, 4 |
| 7 | Analytics dashboard: aggregation endpoints + charts (recharts) | Phase 5, 6 |
| 8 | Deployment: Render (backend) + Vercel (frontend) production config, CORS lockdown, migration strategy, secrets management | All above |

**Exit criteria for this Phase 1 planning stage:** you approve the DB schema, endpoint map, and folder structure below — since Phase 2 will generate real Prisma migrations against your Neon database, schema changes after that point are more costly (require new migrations rather than edits).

---

**Awaiting your approval to proceed to Phase 2 (Prisma schema implementation + Neon migration).** Flag anything you want changed in the schema, roles, statuses, or endpoints now, before it's implemented.

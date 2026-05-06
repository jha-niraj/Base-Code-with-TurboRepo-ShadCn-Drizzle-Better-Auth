# Basecodebase — Starter Monorepo

A production-ready Next.js monorepo starter. Clone it, fill in your `.env`, run `pnpm db:push` and `pnpm dev`, and you have a running app with auth, a typed DB layer, and an admin panel.

## Stack

| Layer | Tool |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 15 (App Router) |
| Database ORM | **Drizzle ORM** (`@repo/db`) |
| Authentication | **Better Auth** (`@repo/auth`) |
| UI components | Shadcn/ui + Radix UI (`@repo/ui`) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript 5.9 |
| DB driver | `postgres` (postgres.js) |
| Package manager | pnpm 9 |

## Workspace layout

```
basecodebase/
├── apps/
│   ├── main/          # Customer-facing Next.js app  (port 3000)
│   └── admin/         # Admin dashboard              (port 3001)
└── packages/
    ├── auth/          # @repo/auth — Better Auth config + client
    ├── db/            # @repo/db   — Drizzle schema + DB client
    ├── ui/            # @repo/ui   — Shared Shadcn component library
    ├── eslint-config/ # Shared ESLint rules
    └── typescript-config/ # Shared tsconfig bases
```

## Environment variables

Copy and fill in before running anything:

```bash
# Required
DATABASE_URL=postgresql://user:password@host:5432/dbname
BETTER_AUTH_SECRET=<random 32-char string>

# Google OAuth (optional — remove the provider block if unused)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App URLs (used by Better Auth trusted origins)
MAIN_APP_URL=http://localhost:3000
ADMIN_APP_URL=http://localhost:3001
```

> **Note:** `GOOGLE_SECRET_ID` from the old NextAuth setup is now `GOOGLE_CLIENT_SECRET`.

## Getting started

```bash
pnpm install            # install all workspace deps

# Push schema to DB (first time or after schema changes)
pnpm --filter @repo/db db:push

pnpm dev                # run all apps in watch mode
```

## Database (`packages/db`)

Single schema file at `packages/db/src/schema.ts`. It contains:

- **Better Auth core tables**: `user`, `session`, `account`, `verification`
- **Custom user fields**: `role` (USER | ADMIN), `address`
- **Admin tables**: `adminAccess`, `adminInvitation`, `adminAuditLog`,
  `adminDashboardStats`, `adminNotification`, `adminSystemSettings`

### DB commands (run from repo root)

```bash
pnpm --filter @repo/db db:push      # push schema directly (dev)
pnpm --filter @repo/db db:generate  # generate SQL migrations (prod)
pnpm --filter @repo/db db:migrate   # apply migrations (prod)
pnpm --filter @repo/db db:studio    # open Drizzle Studio
```

### Using the DB client

```typescript
import { db } from '@repo/db'
import { user, adminAccess } from '@repo/db/schema'
import { eq } from 'drizzle-orm'

// Relational query (recommended for reads with relations)
const admin = await db.query.adminAccess.findFirst({
    where: (a, { eq }) => eq(a.userId, userId),
    with: { user: true },
})

// Core API (recommended for writes)
await db.update(user)
    .set({ name: 'New Name', updatedAt: new Date() })
    .where(eq(user.id, userId))
```

## Authentication (`packages/auth`)

Better Auth replaces NextAuth. The config lives in `packages/auth/src/auth.ts`.

### Supported sign-in methods

- **Email + password** (enabled by default)
- **Google OAuth** (configure env vars to activate)

### Server-side session

```typescript
import { auth } from '@repo/auth'
import { headers } from 'next/headers'

const session = await auth.api.getSession({ headers: await headers() })
// session?.user.id, session?.user.email, session?.user.role
```

### Client-side hooks (in `'use client'` components)

```typescript
import { useSession, signIn, signOut } from '@repo/auth/client'

const { data: session, isPending } = useSession()

await signIn.email({ email, password, callbackURL: '/dashboard' })
await signIn.social({ provider: 'google', callbackURL: '/dashboard' })
await signOut()
```

### API route

Both apps expose Better Auth at `/api/auth/[...all]`. No additional setup needed.

### Middleware (route protection)

```typescript
// apps/main/middleware.ts
import { authMiddleware } from '@repo/auth/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const session = await authMiddleware(request)
    if (!session) return NextResponse.redirect(new URL('/signin', request.url))
    return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
```

## Admin panel (`apps/admin`)

The admin app runs on port 3001 and has its own auth route at `/api/auth/[...all]`.

### Admin access flow

1. A `SUPER_ADMIN` creates an invitation via `createAdminInvitation()`
2. The invitee receives an access code (e.g., `ADMIN-X7K4MNQR`)
3. They POST to `/api/auth/verifycode` with their email and the code
4. A user + credential account + `AdminAccess` record are created
5. They set a permanent password via `setAdminPassword()`

### Admin roles

`SUPER_ADMIN` → `CONTENT_ADMIN` → `FINANCE_ADMIN` → `COMMUNITY_ADMIN` → `MODULE_MANAGER` → `VIEWER`

### Server actions

All admin operations are in `apps/admin/actions/`:

- `admin.action.ts` — CRUD for admin users, invitations, audit logs
- `system.action.ts` — System settings, notifications, health check

## Adding a new feature

1. **Add a DB table** in `packages/db/src/schema.ts`, then run `pnpm --filter @repo/db db:push`
2. **Add server actions** in `apps/<app>/actions/`
3. **Add pages** under `apps/<app>/app/`
4. **Add UI components** to `packages/ui/src/` if reusable across apps

## Status

| Feature | Status |
|---|---|
| Drizzle ORM | ✅ Configured |
| Better Auth (email + password) | ✅ Configured |
| Better Auth (Google OAuth) | ✅ Ready (needs env vars) |
| Admin panel | ✅ Functional |
| Admin invitation flow | ✅ Functional |
| Audit logging | ✅ Functional |
| System settings | ✅ Functional |
| DB migrations (prod) | ⚙️ Use `db:generate` + `db:migrate` |
| Email verification | ⚙️ Configure SMTP in Better Auth |
| Middleware (route guards) | ⚙️ Add `middleware.ts` per app |

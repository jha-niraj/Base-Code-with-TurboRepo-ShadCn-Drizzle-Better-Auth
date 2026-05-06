# Basecodebase — Next.js Monorepo Starter

A batteries-included monorepo starter built with Turborepo. Comes pre-wired with **Drizzle ORM**, **Better Auth**, and a full **admin panel** — so you ship features instead of boilerplate.

## What's inside

```
apps/
  main/   → customer-facing Next.js app  (port 3000)
  admin/  → admin dashboard              (port 3001)
packages/
  auth/   → @repo/auth  — Better Auth (email/password + Google OAuth)
  db/     → @repo/db    — Drizzle ORM + PostgreSQL schema
  ui/     → @repo/ui    — Shared Shadcn/ui component library
```

## Tech stack

- **Framework**: Next.js 15 (App Router, React 19)
- **ORM**: Drizzle ORM + postgres.js
- **Auth**: Better Auth
- **UI**: Shadcn/ui + Tailwind CSS v4
- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript 5.9

## Quick start

```bash
# 1. Copy env and fill in DATABASE_URL + BETTER_AUTH_SECRET
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Push schema to the database
pnpm --filter @repo/db db:push

# 4. Run all apps
pnpm dev
```

Visit `http://localhost:3000` for the main app and `http://localhost:3001` for the admin panel.

## Environment variables

```bash
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<random 32+ char string>

# Optional — Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App URLs (for trusted origins)
MAIN_APP_URL=http://localhost:3000
ADMIN_APP_URL=http://localhost:3001
```

## Common tasks

```bash
pnpm dev                              # run all apps
pnpm build                            # build all apps
pnpm --filter @repo/db db:push        # sync schema to DB (dev)
pnpm --filter @repo/db db:generate    # generate migration files (prod)
pnpm --filter @repo/db db:migrate     # apply migrations (prod)
pnpm --filter @repo/db db:studio      # open Drizzle Studio
```

For full documentation, see [CLAUDE.md](./CLAUDE.md).

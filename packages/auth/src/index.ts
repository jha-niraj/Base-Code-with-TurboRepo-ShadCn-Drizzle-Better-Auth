// Server-side exports — only import in server components / server actions
export { auth } from './auth'
export type { Session, User } from './auth'

// Next.js route handler helper
export { toNextJsHandler } from 'better-auth/next-js'

// =========================================================
// IMPORTANT: Separate imports for different contexts
// =========================================================
// For MIDDLEWARE (Edge Runtime):
//   import { authMiddleware } from '@repo/auth/middleware'
//
// For CLIENT components ('use client'):
//   import { authClient, signIn, signOut, useSession } from '@repo/auth/client'
// =========================================================

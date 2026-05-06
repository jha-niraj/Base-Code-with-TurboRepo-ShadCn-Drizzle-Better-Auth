import type { NextRequest } from 'next/server'
import { auth } from './auth'

// Helper to get the session in Next.js middleware (Edge Runtime compatible).
// Note: Better Auth's full server SDK is not edge-compatible; use this lightweight check.
export async function authMiddleware(request: NextRequest) {
    return auth.api.getSession({ headers: request.headers })
}

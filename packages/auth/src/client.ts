import { createAuthClient } from 'better-auth/react'

// Auth client — uses the current page's origin automatically.
// No provider wrapper needed; useSession works directly in components.
export const authClient = createAuthClient()

export const { signIn, signOut, useSession, getSession } = authClient

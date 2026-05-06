import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@repo/db'
import { user, session, account, verification } from '@repo/db/schema'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: { user, session, account, verification },
    }),

    emailAndPassword: {
        enabled: true,
    },

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        },
    },

    // Trust both app origins in development
    trustedOrigins: [
        process.env.MAIN_APP_URL || 'http://localhost:3000',
        process.env.ADMIN_APP_URL || 'http://localhost:3001',
    ],

    user: {
        additionalFields: {
            role: {
                type: 'string',
                defaultValue: 'USER',
            },
            address: {
                type: 'string',
                required: false,
                input: false,
            },
        },
    },
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user

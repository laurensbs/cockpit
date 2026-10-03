import 'server-only'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { isOwnerEmail, signUpRefusal } from './owner'
import { APP_NAME, ownerEmails, siteUrl, trustedOrigins } from './site'

const baseURL = siteUrl()

// Never sign real sessions with the development fallback.
if (process.env.VERCEL_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is not set for production')
}

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? 'cockpit-local-development-secret-change-me-00000',
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // autoSignIn stays on: with it off, Better Auth answers a refused sign-up with a fake success.
  emailAndPassword: { enabled: true, minPasswordLength: 10, autoSignIn: true },
  // Kept in the database, so every serverless instance counts the same attempts.
  rateLimit: { storage: 'database' },
  trustedOrigins: trustedOrigins(),
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.startsWith('/sign-up')) return
      const body = (ctx.body ?? {}) as { email?: unknown; setupCode?: unknown }
      const refusal = signUpRefusal({
        email: typeof body.email === 'string' ? body.email : '',
        setupCode: body.setupCode,
        owners: ownerEmails(),
        expectedCode: process.env.OWNER_SETUP_CODE,
        production: process.env.NODE_ENV === 'production',
      })
      if (refusal) throw new APIError('FORBIDDEN', { message: refusal })
    }),
  },
  databaseHooks: {
    // A second lock: whatever the route, no account is ever made for an address that is not the owner's.
    user: {
      create: {
        before: async (user) => {
          if (!isOwnerEmail(user.email, ownerEmails())) throw new APIError('FORBIDDEN', { message: 'not-owner' })
        },
      },
    },
  },
  plugins: [passkey({ rpID: new URL(baseURL).hostname, rpName: APP_NAME, origin: baseURL }), nextCookies()],
})

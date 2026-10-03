import { toNextJsHandler } from 'better-auth/next-js'
import { ready } from '@/db'
import { auth } from '@/lib/auth'

const handler = toNextJsHandler(auth)

export async function GET(request: Request) {
  await ready()
  return handler.GET(request)
}

export async function POST(request: Request) {
  await ready()
  return handler.POST(request)
}

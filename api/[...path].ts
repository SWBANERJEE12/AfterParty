import type { IncomingMessage, ServerResponse } from 'node:http'
import '../server/loadEnv'
import { createApiApp } from '../server/apiApp'

let app: ReturnType<typeof createApiApp> | undefined

function getApp() {
  app ??= createApiApp()
  return app
}

/** Vercel catch-all for `/api/*` — one Express app, same routes as local dev. */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return getApp()(req, res)
}

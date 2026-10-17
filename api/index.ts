import '../server/loadEnv.js'
import { createApiApp } from '../server/apiApp.js'

/** Single Vercel function; vercel.json rewrites all `/api/*` here. */
const app = createApiApp()

export default app

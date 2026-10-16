/**
 * Verifies server env loading from project root (.env + .env.local).
 * Does not print secret values.
 */
import { getServerConfigDiagnostic, logServerConfigOnStartup } from '../server/serverConfig.ts'

const d = getServerConfigDiagnostic()
logServerConfigOnStartup()

if (!d.youtubeApiKey) {
  console.error('\ncheck:server-env — YOUTUBE_API_KEY is not set after loading env files.')
  process.exit(1)
}

console.log('\ncheck:server-env OK — YOUTUBE_API_KEY is present (value not shown).')

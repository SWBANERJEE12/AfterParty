import { isEnvSet, listEnvFilesPresent } from './loadEnv.ts'

export type ServerConfigDiagnostic = {
  omdbApiKey: boolean
  youtubeApiKey: boolean
  envFilesPresent: string[]
  cwd: string
}

export function getServerConfigDiagnostic(): ServerConfigDiagnostic {
  return {
    omdbApiKey: isEnvSet('OMDB_API_KEY'),
    youtubeApiKey: isEnvSet('YOUTUBE_API_KEY'),
    envFilesPresent: listEnvFilesPresent(),
    cwd: process.cwd(),
  }
}

export function logServerConfigOnStartup() {
  const d = getServerConfigDiagnostic()
  const files = d.envFilesPresent.length > 0 ? d.envFilesPresent.join(', ') : '(none — create .env or .env.local in project root)'
  console.log(`[afterparty:config] cwd=${d.cwd}`)
  console.log(`[afterparty:config] env files loaded: ${files}`)
  console.log(`[afterparty:config] OMDB_API_KEY: ${d.omdbApiKey ? 'set' : 'missing'}`)
  console.log(`[afterparty:config] YOUTUBE_API_KEY: ${d.youtubeApiKey ? 'set' : 'missing'}`)
  if (!d.youtubeApiKey) {
    console.log(
      '[afterparty:config] Trailers disabled until YOUTUBE_API_KEY is added to .env or .env.local (project root), then restart npm run dev',
    )
  }
}

export const YOUTUBE_KEY_SETUP_HINT =
  'Add YOUTUBE_API_KEY to .env or .env.local in the project root (same folder as package.json), then restart the server with npm run dev.'

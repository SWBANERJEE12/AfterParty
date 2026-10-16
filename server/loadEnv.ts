import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_FILES = ['.env', '.env.local'] as const

/** Load `.env` then `.env.local` from project root (later file wins). */
export function loadEnvFiles(cwd = process.cwd()) {
  for (const file of ENV_FILES) {
    const path = resolve(cwd, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  }
}

export function listEnvFilesPresent(cwd = process.cwd()): string[] {
  return ENV_FILES.filter((file) => existsSync(resolve(cwd, file)))
}

/** Whether a non-empty server secret is set (never logs the value). */
export function isEnvSet(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

// Must run before any route/module reads process.env (imported first from server/index.ts).
loadEnvFiles()

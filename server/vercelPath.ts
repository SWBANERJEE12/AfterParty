import type { NextFunction, Request, Response } from 'express'

const INVOKE_PATH_HEADERS = ['x-vercel-path', 'x-invoke-path', 'x-vercel-original-path'] as const

/** Normalize request paths when Vercel rewrites subpaths to `/api`. */
export function vercelPathMiddleware(req: Request, _res: Response, next: NextFunction) {
  for (const header of INVOKE_PATH_HEADERS) {
    const original = req.headers[header]
    const path = typeof original === 'string' ? original : Array.isArray(original) ? original[0] : undefined
    if (path && path.startsWith('/')) {
      req.url = path.includes('?') ? path : path + (req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')
      break
    }
  }

  const raw = req.url ?? '/'
  const qIndex = raw.indexOf('?')
  const qs = qIndex >= 0 ? raw.slice(qIndex) : ''
  const pathname = qIndex >= 0 ? raw.slice(0, qIndex) : raw

  if (pathname === '/health' || pathname.startsWith('/api')) {
    next()
    return
  }

  const segment = pathname.startsWith('/') ? pathname : `/${pathname}`
  req.url = `/api${segment}${qs}`
  next()
}

import type { NextFunction, Request, Response } from 'express'

/** Normalize request paths when Vercel rewrites or catch-all strips the `/api` prefix. */
export function vercelPathMiddleware(req: Request, _res: Response, next: NextFunction) {
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

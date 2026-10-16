import type { NextFunction, Request, Response } from 'express'

type Options = {
  windowMs: number
  max: number
}

const buckets = new Map<string, number[]>()

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

export function createRateLimiter(options: Options) {
  const { windowMs, max } = options
  return (req: Request, res: Response, next: NextFunction) => {
    const key = clientKey(req)
    const now = Date.now()
    const windowStart = now - windowMs
    const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart)
    if (hits.length >= max) {
      res.status(429).json({ error: 'Too many requests. Try again shortly.' })
      return
    }
    hits.push(now)
    buckets.set(key, hits)
    next()
  }
}

/**
 * Short-term limits per IP address, against scripts hammering the API (scraping the library, flooding the
 * waitlist). Counted in memory per server instance, in fixed windows: Cloud Run may run a few instances, so a
 * limit is approximate, which is enough to make bulk copying slow. Daily limits per account live elsewhere.
 */
export interface Rule {
  name: string
  /** requests allowed per window */
  limit: number
  windowMs: number
  matches: (method: string, path: string) => boolean
}

export const RULES: Rule[] = [
  { name: 'library search', limit: 120, windowMs: 60_000, matches: (m, p) => m === 'GET' && p === '/v1/library/match' },
  { name: 'library', limit: 240, windowMs: 60_000, matches: (m, p) => m === 'GET' && p.startsWith('/v1/library') && !p.startsWith('/v1/library/drafts') },
  { name: 'sign-ups and messages', limit: 20, windowMs: 60_000, matches: (m, p) => m === 'POST' && (p === '/v1/waitlist' || p === '/v1/feedback') },
  { name: 'share links', limit: 240, windowMs: 60_000, matches: (_m, p) => p.startsWith('/v1/shares') },
  // everything else together. A whole class at a school often shares one address, so this is sized for 40 or
  // so students at once: still a wall for a script copying the site
  { name: 'everything', limit: 1200, windowMs: 60_000, matches: () => true },
]

export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>()
  private sweptAt = 0
  constructor(
    private rules: Rule[] = RULES,
    private now: () => number = Date.now,
  ) {}

  /** counts a request; the first rule it breaks (and when to try again), or null if it may go ahead */
  check(ip: string, method: string, path: string): { rule: string; retryAfterS: number } | null {
    const t = this.now()
    this.sweep(t)
    for (const rule of this.rules) {
      if (!rule.matches(method, path)) continue
      const key = `${rule.name}|${ip}`
      const w = this.hits.get(key)
      if (!w || t - w.start >= rule.windowMs) {
        this.hits.set(key, { start: t, count: 1 })
        continue
      }
      w.count++
      if (w.count > rule.limit) return { rule: rule.name, retryAfterS: Math.max(1, Math.ceil((w.start + rule.windowMs - t) / 1000)) }
    }
    return null
  }

  /** forgets windows that have ended, now and then, so memory stays small */
  private sweep(t: number) {
    if (t - this.sweptAt < 60_000) return
    this.sweptAt = t
    const longest = Math.max(...this.rules.map((r) => r.windowMs))
    for (const [k, w] of this.hits) if (t - w.start >= longest) this.hits.delete(k)
  }
}

/** the caller's address: Cloud Run's front end puts it first in X-Forwarded-For */
export const clientIp = (forwarded?: string | null) => forwarded?.split(',')[0]?.trim() || 'unknown'

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * A minimal in-memory, per-IP, fixed-window rate limiter for the small
 * set of public, unauthenticated write endpoints this project's own
 * IMPLEMENTATION-PLAN.md flags as having no abuse protection yet (seller
 * application submission, activation-token exchange, and every auth
 * login/register endpoint). See docs/SECURITY.md's pre-launch hardening
 * section.
 *
 * Deliberately simple, not a general-purpose library: this project has
 * no background worker or shared cache today (see docs/DEPLOYMENT.md §9),
 * so a Redis-backed limiter would be a bigger, separate change. This
 * implementation is correct for exactly what it's used for - blunt abuse
 * protection on a handful of routes on a single instance - and honestly
 * documented as not coordinating across multiple backend instances. Once
 * this project runs more than one instance, replace the in-memory Map
 * below with a Redis-backed store (the REDIS_URL this project already
 * wires for cache/event-bus/locking - see medusa-config.ts - would be the
 * natural backing store).
 */

interface Bucket {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  /** Rolling window length, in milliseconds. */
  windowMs: number
  /** Maximum requests from one IP within the window. */
  max: number
  message?: string
}

const buckets = new Map<string, Bucket>()

// Opportunistic cleanup so `buckets` doesn't grow unbounded on a
// long-running process - triggered on the rare occasion the map has
// grown large, not on a timer (no background scheduler exists in this
// project - see docs/DEPLOYMENT.md §9).
const SWEEP_THRESHOLD = 50_000

function sweepExpired(now: number) {
  if (buckets.size < SWEEP_THRESHOLD) {
    return
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

/** Test-only: clears all rate-limit state between test cases/files. */
export function resetRateLimiterState(): void {
  buckets.clear()
}

export function rateLimit({ windowMs, max, message }: RateLimitOptions) {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const key = req.ip ?? "unknown"
    const now = Date.now()
    sweepExpired(now)

    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    if (bucket.count >= max) {
      res.status(429).json({
        message: message ?? "Too many requests. Please try again later.",
      })
      return
    }

    bucket.count += 1
    next()
  }
}

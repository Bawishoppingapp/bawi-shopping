// Soak test: a low, steady virtual-user count held for an extended
// duration, watching for the failure modes a short load test can't catch
// - memory growth, connection-pool exhaustion, slow response-time drift.
// This is the one that genuinely needs real deployed staging
// infrastructure and real time (hours, not minutes) to mean anything -
// see docs/LAUNCH-CHECKLIST.md §11. SOAK_DURATION defaults to a short
// value so this script can be dry-run locally in minutes; override it to
// something like "4h" or "24h" for the real thing.
//
// Usage: k6 run -e BASE_URL=https://shop.example.com -e SOAK_DURATION=4h soak.js

import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"
const SOAK_DURATION = __ENV.SOAK_DURATION || "5m"

export const options = {
  vus: 5,
  duration: SOAK_DURATION,
  thresholds: {
    // A soak test's real value is in the trend, not a single threshold -
    // review the full time series (p95 over time, error rate over time)
    // after the run, not just whether this pass/fail gate tripped.
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.02"],
  },
}

export default function () {
  const home = http.get(`${BASE_URL}/`)
  check(home, { "homepage returns 200": (r) => r.status === 200 })

  sleep(2)

  const search = http.get(`${BASE_URL}/search`)
  check(search, { "search returns 200": (r) => r.status === 200 })

  sleep(3)
}

// Smoke test: a handful of virtual users, a few seconds, covering the
// storefront's core public pages. Run this first against any newly
// deployed environment before the heavier load.js/soak.js scripts -
// if this doesn't pass cleanly, a real load test will only produce noise.
//
// Usage: k6 run -e BASE_URL=https://shop.example.com smoke.js
// (BASE_URL defaults to http://localhost:3000 for local testing.)

import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"

export const options = {
  vus: 3,
  duration: "20s",
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
}

export default function () {
  const home = http.get(`${BASE_URL}/`)
  check(home, {
    "homepage returns 200": (r) => r.status === 200,
  })

  const search = http.get(`${BASE_URL}/search`)
  check(search, {
    "search page returns 200": (r) => r.status === 200,
  })

  sleep(1)
}

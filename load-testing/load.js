// Load test: a ramping virtual-user profile exercising the storefront's
// real customer journey - homepage -> search -> product detail - plus a
// direct hit against the backend's public discovery API. Thresholds are a
// starting point (see README.md), not a certified SLA; tune them once you
// have a real baseline from a real deployed environment.
//
// Usage: k6 run -e BASE_URL=https://shop.example.com -e BACKEND_URL=https://api.example.com load.js
// (both default to localhost for local testing - see README.md.)

import http from "k6/http"
import { check, group, sleep } from "k6"
import { Trend } from "k6/metrics"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"
const BACKEND_URL = __ENV.BACKEND_URL || "http://localhost:9000"

const productPageDuration = new Trend("product_page_duration", true)

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // ramp up
    { duration: "1m", target: 10 }, // hold
    { duration: "30s", target: 25 }, // ramp to peak
    { duration: "1m", target: 25 }, // hold at peak
    { duration: "30s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500", "p(99)<3000"],
    http_req_failed: ["rate<0.02"],
  },
}

// Resolve a real product code once per VU iteration rather than
// hardcoding one - keeps the script working against any environment's
// actual catalog instead of a fixture that may not exist there.
function resolveAProductCode() {
  const res = http.get(`${BACKEND_URL}/products?limit=20`)
  if (res.status !== 200) {
    return null
  }
  try {
    const body = JSON.parse(res.body)
    const products = body.products || body.hits || []
    if (products.length === 0) {
      return null
    }
    const pick = products[Math.floor(Math.random() * products.length)]
    return pick.productCode || pick.product_code || pick.code || null
  } catch {
    return null
  }
}

export default function () {
  group("homepage", () => {
    const res = http.get(`${BASE_URL}/`)
    check(res, { "homepage returns 200": (r) => r.status === 200 })
  })

  sleep(Math.random() * 2 + 1)

  group("search", () => {
    const res = http.get(`${BASE_URL}/search`)
    check(res, { "search returns 200": (r) => r.status === 200 })
  })

  sleep(Math.random() * 2 + 1)

  group("product detail", () => {
    const code = resolveAProductCode()
    if (!code) {
      return
    }
    const start = Date.now()
    const res = http.get(`${BASE_URL}/products/${code}`)
    productPageDuration.add(Date.now() - start)
    check(res, { "product page returns 200": (r) => r.status === 200 })
  })

  sleep(Math.random() * 3 + 1)
}

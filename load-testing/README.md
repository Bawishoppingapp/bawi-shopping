# Load & Soak Testing

[k6](https://k6.io) scripts covering the storefront's core customer
journey. See `docs/LAUNCH-CHECKLIST.md` §11 for where this fits into the
overall launch process.

**Real load and soak testing needs real deployed infrastructure** — these
scripts can be pointed at `localhost` for a quick sanity check (and have
been, during this project's own production-prep pass — see
`load-testing/RESULTS.md`), but that only proves the scripts work and
surfaces obvious local regressions. It is not a substitute for running
them against a real staging or production environment under realistic
network conditions, database size, and traffic patterns.

## Scripts

| Script | Purpose | Typical duration |
|---|---|---|
| `smoke.js` | A handful of VUs, ~20s - run this first against any newly deployed environment | seconds |
| `load.js` | A ramping profile up to 25 concurrent VUs, exercising homepage → search → product detail | ~3.5 minutes |
| `soak.js` | A low, steady VU count held for an extended duration, watching for drift/leaks over time | minutes locally, hours/days for a real soak test |

## Install k6

```bash
brew install k6   # macOS
# or download a binary directly from https://github.com/grafana/k6/releases
```

## Usage

```bash
# Against local dev servers (backend on :9000, storefront on :3000):
k6 run load-testing/smoke.js
k6 run load-testing/load.js

# Against a real deployed environment:
k6 run -e BASE_URL=https://shop.example.com -e BACKEND_URL=https://api.example.com load-testing/load.js

# A real soak test - override the duration, then actually leave it running:
k6 run -e BASE_URL=https://staging.example.com -e SOAK_DURATION=4h load-testing/soak.js
```

## Reading the results

k6 prints a summary at the end of every run: request counts, pass/fail
checks, and duration percentiles (p50/p90/p95/p99). The two thresholds
that matter most:

- `http_req_duration` p95/p99 — if this creeps up as VUs increase, that's
  the point at which the current infrastructure sizing (`infra/terraform`
  §`variables.tf`'s task CPU/memory, RDS instance class, ECS desired
  count) needs to grow before real launch traffic.
- `http_req_failed` rate — any non-negligible failure rate under load that
  doesn't happen at low VU counts points at a real bottleneck (database
  connection pool, ECS task count, RDS instance class) — investigate
  before launch, don't just retry until it passes.

For a soak test specifically, don't just look at the final summary — plot
p95 and error rate *over time* across the whole run. A soak test's real
value is catching *drift* (things getting slowly worse), which a
snapshot at the end won't show.

## What this project's own dry run found

See `load-testing/RESULTS.md` for the actual output from running
`smoke.js` and `load.js` against this project's local dev servers during
this production-prep pass — a genuine result, not fabricated, but against
local dev-mode Node processes on a laptop, not real deployed
infrastructure. Treat it as "the tooling works and nothing catastrophic
showed up locally," not as a real capacity/performance certification.

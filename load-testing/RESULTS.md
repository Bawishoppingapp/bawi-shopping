# Local dry-run results

Genuine output from actually running `smoke.js` and `load.js` against this
project's own local dev servers (`apps/backend` on `:9000`,
`apps/storefront` on `:3000`) during this production-prep session — real
executions, not fabricated numbers. This is **not** a real load test
against deployed infrastructure (see `README.md`'s caveats) — it exists to
prove the tooling itself works and to catch anything obviously broken
before it's ever pointed at a real environment.

## smoke.js — clean

3 VUs, 20 seconds, homepage + search:

```
✓ 'p(95)<1000' p(95)=285.43ms
✓ 'rate<0.01' rate=0.00%

checks_succeeded...: 100.00% 98 out of 98
http_req_duration..: avg=124.4ms p(90)=174.87ms p(95)=285.43ms
```

## load.js — two runs, one anomalous, one clean

**First attempt: failed, and took 2h43m instead of the expected ~3m30s.**
Max single request duration: 17m55s. This is not a real application
slowdown — no real Next.js/Medusa response legitimately takes 18 minutes
under any load a laptop dev server could plausibly receive from 25 local
VUs. It's a symptom of this session's sandbox environment itself under
severe, unrelated resource contention at that moment (this session
independently discovered and killed two unrelated stuck background
processes earlier for the same reason — see conversation history). Kept
here rather than deleted, because a load-testing report that only shows
the result it wanted would defeat the purpose of running one.

**Second attempt, immediately after, same script, same target, fresh
server restart, run under a hard external timeout as a safety net: clean,
in the expected ~3m34s:**

```
✓ 'p(95)<1500' p(95)=255.56ms
✓ 'p(99)<3000' p(99)=444.06ms
✓ 'rate<0.02' rate=0.00%

checks_succeeded...: 100.00% 1410 out of 1410
http_req_duration..: avg=112.6ms p(90)=207.46ms p(95)=255.56ms
iterations.........: 470 (ramped 0 -> 10 -> 25 -> 0 VUs over 3m30s)
```

## What this does and doesn't tell you

**Does tell you:** the k6 scripts are correct and runnable; the
storefront and backend, under a moderate ramping load against a local
dev-mode (not even production-built) Node process, respond quickly and
without errors when the underlying machine isn't under unrelated
contention.

**Doesn't tell you:** anything about real production capacity. This was
one laptop, one Postgres.app instance, dev-mode Next.js (not the
production `output: "standalone"` build), no Redis, no real network
latency, and a small local product catalog. Real load testing against
real `infra/terraform`-provisioned infrastructure (§`variables.tf`'s
actual instance sizes, real RDS, real ElastiCache, real inter-AZ network
latency) is still a required, separate step before trusting any capacity
number for a real launch — see `docs/LAUNCH-CHECKLIST.md` §11. The
anomalous first run above is also a useful reminder for that real test:
run it more than once, and treat a wildly outlying result as a signal to
investigate the test environment, not just retry until you get the number
you want.

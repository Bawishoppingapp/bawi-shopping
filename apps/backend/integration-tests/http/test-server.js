const { spawn, execSync } = require("child_process")
const path = require("path")
const fs = require("fs")
const os = require("os")

const BACKEND_ROOT = path.resolve(__dirname, "../..")
const BUILD_ROOT = path.join(BACKEND_ROOT, ".medusa/server")
const PORT = 9199
// The child's own stdout/stderr is only ever buffered in memory for the
// "did it start" check below, never surfaced anywhere - if it crashes
// mid-suite the real cause is otherwise invisible. Persisting a copy here
// makes that diagnosable after the fact.
const SERVER_LOG_PATH = path.join(os.tmpdir(), "medusa-test-server.log")

/**
 * Boots the real Medusa server as a child process against the test
 * database, rather than relying on @medusajs/test-utils' bootstrap
 * (which manages its own db lifecycle assumptions that don't line up
 * with this project's local, non-standard Postgres.app setup). Tests
 * talk to it exactly like production traffic would: real HTTP, real
 * signed JWTs, real Postgres - nothing mocked.
 *
 * The HTTP-test script builds once before Jest starts, then each suite runs
 * Medusa's production server. This deliberately avoids `medusa develop`:
 * its file/type watchers can outlive a suite, retain database connections,
 * and exhaust the small Postgres service used in CI.
 */
function freePort() {
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9`, { stdio: "ignore" })
  } catch {
    // Nothing was listening - that's the goal either way.
  }
}

/**
 * Older test runs used `medusa develop`, which spawns a type-watcher
 * sub-process that does not listen on any port, so freePort() (kill by
 * port) never catches it - and it has been observed to survive even
 * `process.kill(-child.pid, "SIGTERM")` on the process group, leaking one
 * zombie per test run. Left unchecked across many runs in a long session,
 * these accumulate and can exhaust enough memory/DB connections to crash
 * a later test run outright. A targeted, unambiguous kill-by-command-line
 * pattern is the reliable cleanup - this exact command line has no
 * legitimate reason to exist outside a `medusa develop` invocation. Keep
 * this cleanup temporarily so a previously interrupted local run cannot
 * interfere with the production-style server below.
 */
function killStrayTypeWatchers() {
  try {
    execSync(`pkill -9 -f "medusajs/cli/cli.js start --types"`, { stdio: "ignore" })
  } catch {
    // Nothing matched - that's the goal either way (pkill exits non-zero
    // when there's nothing to kill).
  }
}

function startTestServer() {
  freePort()
  killStrayTypeWatchers()

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["medusa", "start", "--port", String(PORT)], {
      // `medusa build` writes the standalone production app here. Medusa's
      // production server must be started from this directory so its compiled
      // config and `public/admin/index.html` resolve relative to the build.
      cwd: BUILD_ROOT,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: "test",
        ENABLE_TEST_SUPPORT_ROUTES: "true",
        DISABLE_MEDUSA_ADMIN_UI: "true",
        // Medusa 2.19 no longer accepts the yargs-style `--no-color`
        // switch. Disable terminal escape sequences through the standard
        // environment variables instead so the production server command
        // remains valid in CI and local integration runs.
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        PORT: String(PORT),
        // Preserve CI's authenticated URL. The fallback matches the
        // passwordless local Postgres.app setup documented for this repo.
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test",
        JWT_SECRET: "test-secret",
        COOKIE_SECRET: "test-secret",
      },
    })

    let settled = false
    let output = ""
    const logStream = fs.createWriteStream(SERVER_LOG_PATH, { flags: "a" })
    logStream.write(`\n--- test-server started at ${new Date().toISOString()} ---\n`)

    const onData = (data) => {
      output += data.toString()
      logStream.write(data)
      if (!settled && /Server is ready/i.test(output)) {
        settled = true
        resolve(child)
      }
    }

    child.stdout.on("data", onData)
    child.stderr.on("data", onData)

    child.on("error", (err) => {
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    child.on("exit", (code) => {
      if (!settled) {
        settled = true
        reject(new Error(`medusa start exited early (code ${code}): ${output}`))
      }
    })

    setTimeout(() => {
      if (!settled) {
        settled = true
        freePort()
        reject(new Error(`Timed out waiting for server to start:\n${output}`))
      }
    }, 90 * 1000)
  })
}

function stopTestServer(child) {
  return new Promise((resolve) => {
    const finish = () => {
      freePort()
      killStrayTypeWatchers()
      resolve()
    }
    if (!child || child.killed) {
      finish()
      return
    }
    child.once("exit", finish)
    try {
      // SIGKILL, not SIGTERM: the type-watcher sub-process has been
      // observed to survive a graceful SIGTERM to the process group,
      // leaking a zombie every run - see killStrayTypeWatchers() above.
      process.kill(-child.pid, "SIGKILL")
    } catch {
      child.kill("SIGKILL")
    }
    setTimeout(finish, 3000)
  })
}

module.exports = { startTestServer, stopTestServer, PORT }

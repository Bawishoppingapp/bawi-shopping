const { spawn, execSync } = require("child_process")
const path = require("path")
const fs = require("fs")
const os = require("os")

const BACKEND_ROOT = path.resolve(__dirname, "../..")
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
 * `medusa develop` runs its own watcher/supervisor process tree, so killing
 * only the immediate child can leave the actual server orphaned holding the
 * port. Freeing the port by PID (before starting, and after stopping) is
 * more reliable here than trying to track/kill the exact process tree.
 */
function freePort() {
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9`, { stdio: "ignore" })
  } catch {
    // Nothing was listening - that's the goal either way.
  }
}

/**
 * `medusa develop` spawns a `cli.js start --types` type-watcher
 * sub-process that does not listen on any port, so freePort() (kill by
 * port) never catches it - and it has been observed to survive even
 * `process.kill(-child.pid, "SIGTERM")` on the process group, leaking one
 * zombie per test run. Left unchecked across many runs in a long session,
 * these accumulate and can exhaust enough memory/DB connections to crash
 * a later test run outright. A targeted, unambiguous kill-by-command-line
 * pattern is the reliable cleanup - this exact command line has no
 * legitimate reason to exist outside a `medusa develop` invocation.
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
    const child = spawn("npx", ["medusa", "develop"], {
      cwd: BACKEND_ROOT,
      detached: true,
      env: {
        ...process.env,
        NODE_ENV: "test",
        ENABLE_TEST_SUPPORT_ROUTES: "true",
        PORT: String(PORT),
        DATABASE_URL:
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
        reject(new Error(`medusa develop exited early (code ${code}): ${output}`))
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

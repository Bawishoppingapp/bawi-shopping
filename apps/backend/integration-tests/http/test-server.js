const { spawn, execSync } = require("child_process")
const path = require("path")

const BACKEND_ROOT = path.resolve(__dirname, "../..")
const PORT = 9199

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

function startTestServer() {
  freePort()

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

    const onData = (data) => {
      output += data.toString()
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
      resolve()
    }
    if (!child || child.killed) {
      finish()
      return
    }
    child.once("exit", finish)
    try {
      process.kill(-child.pid, "SIGTERM")
    } catch {
      child.kill("SIGTERM")
    }
    setTimeout(finish, 5000)
  })
}

module.exports = { startTestServer, stopTestServer, PORT }

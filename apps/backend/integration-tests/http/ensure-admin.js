const { spawnSync } = require("node:child_process")
const { loadEnv } = require("@medusajs/utils")
const { Client } = require("pg")
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require("./test-server")

// Match Jest's environment loading so this pre-test helper connects to the
// same database configured in .env.test.
loadEnv("test", process.cwd())

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test"

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const existing = await client.query(
      'SELECT 1 FROM "user" WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
      [TEST_ADMIN_EMAIL]
    )
    if (existing.rowCount) return
  } finally {
    await client.end()
  }

  const result = spawnSync(
    "npx",
    ["medusa", "user", "-e", TEST_ADMIN_EMAIL, "-p", TEST_ADMIN_PASSWORD],
    { env: { ...process.env, DATABASE_URL }, stdio: "inherit" }
  )

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

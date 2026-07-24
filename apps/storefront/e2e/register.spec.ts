import { test, expect } from "@playwright/test"

test.describe("Customer registration", () => {
  test("register, land on account page, and keep the session on reload", async ({
    page,
  }) => {
    const email = `e2e-${Date.now()}@example.test`

    await page.goto("/register")
    await page.getByLabel("First name").fill("Jane")
    await page.getByLabel("Last name").fill("Doe")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Correct1horse")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole("heading", { name: "Welcome, Jane" })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    await page.reload()
    await expect(page.getByRole("heading", { name: "Welcome, Jane" })).toBeVisible()
  })

  test("registering with an already-used email shows an error and creates no duplicate", async ({
    page,
  }) => {
    const email = `e2e-dup-${Date.now()}@example.test`

    await page.goto("/register")
    await page.getByLabel("First name").fill("Jane")
    await page.getByLabel("Last name").fill("Doe")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Correct1horse")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.goto("/register")
    await page.getByLabel("First name").fill("Jane")
    await page.getByLabel("Last name").fill("Doe")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Correct1horse")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect(page).toHaveURL(/\/register$/)
    await expect(
      page.getByText("An account with this email already exists.")
    ).toBeVisible()
  })
})

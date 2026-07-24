import { test, expect } from "@playwright/test"

test.describe("Admin route protection", () => {
  test("visiting /applications without a session redirects to /login", async ({ page }) => {
    await page.goto("/applications")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("visiting an application detail page without a session redirects to /login", async ({
    page,
  }) => {
    await page.goto("/applications/not-a-real-id")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("wrong password shows a generic error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("nobody@example.test")
    await page.getByLabel("Password").fill("wrong-password")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("Invalid email or password")).toBeVisible()
  })
})

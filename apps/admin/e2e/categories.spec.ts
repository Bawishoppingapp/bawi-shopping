import { execFileSync } from "node:child_process"
import path from "node:path"
import { test, expect } from "@playwright/test"

const BACKEND_ROOT = path.resolve(__dirname, "../../backend")

function createAdmin(email: string, password: string) {
  execFileSync("npx", ["medusa", "user", "-e", email, "-p", password], {
    cwd: BACKEND_ROOT,
    stdio: "pipe",
  })
}

test.describe("Admin category management", () => {
  const suffix = Date.now()
  const adminEmail = `e2e-category-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"

  test.beforeAll(async () => {
    createAdmin(adminEmail, adminPassword)
  })

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/login")
    await page.getByLabel("Email").fill(adminEmail)
    await page.getByLabel("Password").fill(adminPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/applications$/)
  }

  test("admin creates a parent category, a nested child, and edits a translation", async ({
    page,
  }) => {
    await login(page)

    await page.goto("/categories")
    await page.getByRole("link", { name: "New category" }).click()

    const parentName = `E2E Outerwear ${suffix}`
    await page.getByLabel("Name").fill(parentName)
    await page.getByRole("button", { name: "Create category" }).click()
    await expect(page).toHaveURL(/\/categories$/)
    await expect(page.getByText(parentName)).toBeVisible()

    // --- Create a child under it ---
    await page.getByRole("link", { name: "New category" }).click()
    const childName = `E2E Coats ${suffix}`
    await page.getByLabel("Name").fill(childName)
    await page.getByLabel("Parent category").selectOption({ label: parentName })
    await page.getByRole("button", { name: "Create category" }).click()
    await expect(page).toHaveURL(/\/categories$/)
    await expect(page.getByText(childName)).toBeVisible()

    // --- Edit the child: add a Spanish translation ---
    await page.getByRole("link", { name: childName }).click()
    await page.getByLabel("Español (Spanish)").fill("Abrigos")
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page).toHaveURL(/\/categories$/)

    await page.getByRole("link", { name: childName }).click()
    await expect(page.getByLabel("Español (Spanish)")).toHaveValue("Abrigos")
  })

  test("deleting a category with a child is blocked until the child is removed first", async ({
    page,
  }) => {
    await login(page)

    await page.goto("/categories")
    await page.getByRole("link", { name: "New category" }).click()
    const parentName = `E2E DeleteParent ${suffix}`
    await page.getByLabel("Name").fill(parentName)
    await page.getByRole("button", { name: "Create category" }).click()

    await page.getByRole("link", { name: "New category" }).click()
    const childName = `E2E DeleteChild ${suffix}`
    await page.getByLabel("Name").fill(childName)
    await page.getByLabel("Parent category").selectOption({ label: parentName })
    await page.getByRole("button", { name: "Create category" }).click()

    // Parent cannot be deleted while it still has a child.
    await page.getByRole("link", { name: parentName }).click()
    await page.getByRole("button", { name: "Delete category" }).click()
    await expect(
      page.getByText("Cannot delete a category that has child categories")
    ).toBeVisible()

    // Delete the child first, then the (now-empty) parent succeeds.
    await page.goto("/categories")
    await page.getByRole("link", { name: childName }).click()
    await page.getByRole("button", { name: "Delete category" }).click()
    await expect(page).toHaveURL(/\/categories$/)
    await expect(page.getByText(childName)).not.toBeVisible()

    await page.getByRole("link", { name: parentName }).click()
    await page.getByRole("button", { name: "Delete category" }).click()
    await expect(page).toHaveURL(/\/categories$/)
    await expect(page.getByText(parentName)).not.toBeVisible()
  })
})

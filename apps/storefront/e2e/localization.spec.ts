import { test, expect } from "@playwright/test"

test.describe("Localization foundation", () => {
  test("switching language updates visible text and persists across reload", async ({
    page,
  }) => {
    await page.goto("/register")
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()

    await page.getByLabel("Language").selectOption("am")
    await expect(page.getByRole("heading", { name: "አካውንትዎን ይፍጠሩ" })).toBeVisible()
    await expect(page.getByLabel("ስም", { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole("heading", { name: "አካውንትዎን ይፍጠሩ" })).toBeVisible()
    await expect(page.getByLabel("ቋንቋ")).toHaveValue("am")
  })

  test("English is the default and the fallback locale", async ({ page }) => {
    await page.goto("/register")
    await expect(page.getByLabel("Language")).toHaveValue("en-US")
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible()
  })

  test("renders Simplified Chinese content correctly", async ({ page }) => {
    await page.goto("/register")
    await page.getByLabel("Language").selectOption("zh-CN")
    await expect(page.getByRole("heading", { name: "创建您的账户" })).toBeVisible()
    await expect(page.getByRole("button", { name: "创建账户" })).toBeVisible()
  })

  test("mobile viewport keeps the language selector and form usable with longer translated text", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/register")
    await page.getByLabel("Language").selectOption("es")

    const heading = page.getByRole("heading", { name: "Crea tu cuenta" })
    await expect(heading).toBeVisible()

    const submitButton = page.getByRole("button", { name: "Crear cuenta" })
    await expect(submitButton).toBeVisible()
    const box = await submitButton.boundingBox()
    expect(box).not.toBeNull()
    // The button must stay within the mobile viewport width, not overflow
    // it, even with a translated (longer than English) label.
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  })
})

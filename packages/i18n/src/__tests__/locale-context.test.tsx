import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { LocaleProvider, useTranslations } from "../locale-context"

function Greeting() {
  const t = useTranslations()
  return <p>{t("register.submit")}</p>
}

describe("LocaleProvider / useTranslations", () => {
  test("renders the active locale's string", () => {
    render(
      <LocaleProvider locale="es">
        <Greeting />
      </LocaleProvider>
    )
    expect(screen.getByText("Crear cuenta")).toBeInTheDocument()
  })

  test("falls back to English rendering when the locale is en-US", () => {
    render(
      <LocaleProvider locale="en-US">
        <Greeting />
      </LocaleProvider>
    )
    expect(screen.getByText("Create account")).toBeInTheDocument()
  })

  test("renders Amharic (Ge'ez script) content without transliteration", () => {
    render(
      <LocaleProvider locale="am">
        <Greeting />
      </LocaleProvider>
    )
    expect(screen.getByText("አካውንት ፍጠር")).toBeInTheDocument()
  })

  test("renders Simplified Chinese content", () => {
    render(
      <LocaleProvider locale="zh-CN">
        <Greeting />
      </LocaleProvider>
    )
    expect(screen.getByText("创建账户")).toBeInTheDocument()
  })
})

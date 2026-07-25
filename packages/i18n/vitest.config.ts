import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**"],
    server: {
      deps: {
        inline: [
          "@testing-library/react",
          "@testing-library/dom",
          "@testing-library/jest-dom",
        ],
      },
    },
  },
})

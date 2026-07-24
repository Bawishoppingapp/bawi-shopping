import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // The workspace root also carries a React 18 copy (Medusa's admin
    // dashboard, in apps/backend). Without this, @testing-library/react
    // (hoisted to the workspace root) can resolve that copy while this
    // app's own code resolves its local React 19 - two React instances,
    // one broken render tree.
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
    server: {
      // Forces these through Vite's resolution (where `dedupe` above
      // applies) instead of Node's native require, which would otherwise
      // find the workspace root's React 18 copy (kept there for Medusa's
      // admin dashboard in apps/backend).
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

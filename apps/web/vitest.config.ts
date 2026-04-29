import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Pure-Logic-Tests in supabase/functions/**/*.test.ts laufen mit hier mit,
    // damit kuenftige Edge-Function-PRs keine Vitest-Konfig-Aenderung brauchen.
    // Edge-Function-Tests muessen Browser-/jsdom-frei sein (keine React/DOM-
    // Imports) und keine Deno-Globals nutzen — nur reine TypeScript-Logik.
    include: ["src/**/*.test.{ts,tsx}", "../../supabase/functions/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

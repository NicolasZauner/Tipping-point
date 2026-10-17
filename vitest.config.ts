import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/{unit,property,golden}/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/model/**"],
      thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
    },
  },
});

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules", "test-results", "src/data/generated", "data-raw"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/switch-exhaustiveness-check": "off",
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // The model is pure: no React, no UI, no AI, no clock, no ambient randomness, no I/O.
    // Randomness enters only as a seeded generator passed in by the caller.
    files: ["src/model/**/*.ts", "src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["react", "react-dom", "zustand", "**/ui/**", "**/ai/**", "**/platform/**"],
        },
      ],
      "no-restricted-globals": [
        "error",
        "Date",
        "window",
        "document",
        "localStorage",
        "fetch",
        "performance",
      ],
      "no-restricted-properties": ["error", { object: "Math", property: "random" }],
    },
  },
  {
    // The worker runs the model off the main thread; it never touches the DOM or React.
    files: ["src/worker/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-dom", "zustand", "**/ui/**", "**/ai/**"] },
      ],
    },
  },
  {
    files: ["scripts/**", "tests/**", "*.config.{ts,js}"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
);

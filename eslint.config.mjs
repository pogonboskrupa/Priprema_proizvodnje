import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "docs/**",
    "android/**",
    "next-env.d.ts",
  ]),
  {
    // Učitavanje podataka i pretplate namjerno postavljaju loading/stanje u effectima.
    // Pravila o redoslijedu hookova i njihovim ovisnostima ostaju uključena.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

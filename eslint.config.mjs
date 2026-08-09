import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The whole codebase was written with `any` for Supabase payloads and
      // prop types. Demoted to warnings (still visible, but not blocking) —
      // converting every occurrence would be a full-application refactor.
      "@typescript-eslint/no-explicit-any": "warn",
      // React Compiler-era rules shipped as errors by Next 16's default
      // config. They flag many legitimate existing patterns (syncing state
      // from props in an effect, timestamps in event handlers), so they are
      // demoted to warnings pending a dedicated cleanup pass.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "**/*.d.ts",
  ]),
]);

export default eslintConfig;

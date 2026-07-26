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
    "next-env.d.ts",
    // Bundles temporales de `wrangler dev` (ver docs/PRE-PROD.md Fase 5) —
    // código generado/minificado, no fuente del proyecto.
    ".wrangler/**",
  ]),
]);

export default eslintConfig;

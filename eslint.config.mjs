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
    // v0.20.0+：tsc emit artifacts（不要 lint 已編譯的 .js）
    "**/.law-cutoff-build/**",
    "**/scripts/**/*.js",
    "**/lib/**/*.js",
    "**/src-tauri/target/**",
    "**/src-tauri/gen/**",
  ]),
]);

export default eslintConfig;

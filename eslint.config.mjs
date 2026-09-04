import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // Next 16's React Compiler rule flags every client page that fetches
      // from our own API routes in well-defined lifecycle handlers (initial
      // load + param changes). That pattern is the core of this app; the
      // rule is noise here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "drizzle/**", "next-env.d.ts"]),
]);

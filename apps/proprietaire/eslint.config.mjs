import nextPlugin from "@next/eslint-plugin-next";
import { base, designRules } from "@eguardimmo/config/eslint";

export default [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...base,
  ...designRules,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];

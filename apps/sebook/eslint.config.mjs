import nextPlugin from "@next/eslint-plugin-next";
import { base } from "@eguardimmo/config/eslint";

const NO_RAW_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML'], Property[key.name='dangerouslySetInnerHTML'], AssignmentExpression[left.property.name='innerHTML']",
  message: "HTML brut interdit : seul le module marketplace/JsonLdScript (échappement par serializeJsonLd) peut injecter du contenu.",
};

export default [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...base,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    ignores: ["src/marketplace/JsonLdScript.tsx"],
    rules: { "no-restricted-syntax": ["error", NO_RAW_HTML] },
  },
];

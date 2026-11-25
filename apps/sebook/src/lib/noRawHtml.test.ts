import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Le code est analysé sous le chemin d’un fichier existant du projet : le lint typé exige un fichier du tsconfig.
const eslint = new ESLint({ cwd: process.cwd() });

async function messages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath: `${process.cwd()}/${filePath}` });
  return result?.messages.filter((message) => message.ruleId === "no-restricted-syntax") ?? [];
}

const RAW = `export function Bad({ html }: { html: string }) {\n  return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n`;

describe("règle locale : pas de HTML brut hors JsonLdScript", () => {
  it("refuse dangerouslySetInnerHTML dans un composant", async () => {
    expect(await messages(RAW, "src/components/roost/Skeleton.tsx")).toHaveLength(1);
  });

  it("refuse l’affectation d’innerHTML et le passage par createElement", async () => {
    expect(await messages("export const f = (el: HTMLElement, v: string) => { el.innerHTML = v; };\n", "src/lib/money.ts")).toHaveLength(1);
    expect(await messages('import { createElement } from "react";\nexport const g = (v: string) => createElement("div", { dangerouslySetInnerHTML: { __html: v } });\n', "src/lib/dates.ts")).toHaveLength(1);
  });

  it("n’autorise l’injection que dans le module JsonLdScript", async () => {
    expect(await messages(RAW, "src/marketplace/JsonLdScript.tsx")).toHaveLength(0);
  });
});

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { base, designRules } from '../eslint/index.js';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: designRules,
  cwd: import.meta.dirname,
});

async function messagesFor(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'src/Exemple.tsx' });
  return (result?.messages ?? []).map((message) => message.message);
}

describe('règles de design (ADR 0012)', () => {
  it('interdit le select natif', async () => {
    const messages = await messagesFor('export const A = () => <select><option>a</option></select>;');
    expect(messages).toEqual([expect.stringContaining('sélection avec recherche')]);
  });

  it("interdit l'attribut title sur un bouton", async () => {
    const messages = await messagesFor('export const A = () => <button title="Supprimer">x</button>;');
    expect(messages).toEqual([expect.stringContaining('IconButton')]);
  });

  it.each([
    ['hexadécimal à 3 chiffres', 'export const a = "#fff";'],
    ['hexadécimal à 6 chiffres', 'export const a = "#1A6F84";'],
    ['hexadécimal à 8 chiffres', 'export const a = "#1A6F8480";'],
    ['dans une classe', 'export const A = () => <div className="p-2 text-[#123456]" />;'],
    ['dans un style', "export const A = () => <div style={{ color: '#abc' }} />;"],
    ['dans un gabarit', 'export const a = (x: string) => `${x} #1a6f84`;'],
    ['rgb()', 'export const a = "rgb(1 2 3)";'],
    ['rgba()', 'export const a = "rgba(1, 2, 3, 0.5)";'],
    ['hsl()', 'export const a = "hsl(180 50% 40%)";'],
    ['oklch()', 'export const a = "oklch(0.5 0.1 200)";'],
    ['Tailwind bg-[#', 'export const a = "bg-[#fff]";'],
    ['Tailwind border-[rgb', 'export const a = "border-[rgb(1,2,3)]";'],
    ['Tailwind [color:', 'export const a = "[color:var(--x)]";'],
  ])('interdit une couleur en dur : %s', async (_nom, code) => {
    const messages = await messagesFor(code);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(message).toMatch(/interdite/);
  });

  it.each([
    ['classes de rôles', 'export const A = () => <div className="bg-surface text-fg border-line" />;'],
    ['bouton avec aria-label', 'export const A = () => <button aria-label="Supprimer">x</button>;'],
    ['ancre', 'export const a = "/page#section-2";'],
    ['entité HTML', 'export const a = "&#169;";'],
    ['variable CSS', 'export const a = "var(--color-bg-surface)";'],
    ['taille arbitraire', 'export const a = "text-[14px] w-[calc(100%-8px)]";'],
  ])('accepte un code conforme : %s', async (_nom, code) => {
    expect(await messagesFor(code)).toEqual([]);
  });
});

describe('configuration de base', () => {
  it('active les règles a11y et hooks sur les fichiers TSX', async () => {
    const cfg = new ESLint({ overrideConfigFile: true, overrideConfig: base, cwd: import.meta.dirname });
    const config = (await cfg.calculateConfigForFile('src/Exemple.tsx')) as {
      rules: Record<string, unknown>;
    };
    expect(config.rules).toHaveProperty(['jsx-a11y/alt-text']);
    expect(config.rules).toHaveProperty(['react-hooks/rules-of-hooks']);
    expect(config.rules).toHaveProperty(['@typescript-eslint/no-explicit-any']);
  });
});

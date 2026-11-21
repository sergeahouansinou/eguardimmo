import { unavailableFamilyOf as bailleurFamilyOf } from "@eguardimmo/gestion";
import { type HelpCenterData, helpCenterSchema } from "@eguardimmo/messagerie";
import { describe, expect, it } from "vitest";
import { unavailableFamilyOf as mandantFamilyOf } from "@/owner/capabilities";
import { HELP_UPDATED_AT, bailleurHelpCenter, mandantHelpCenter } from "./helpContent";

const spaces: [string, HelpCenterData, (href: string) => string | null][] = [
  ["bailleur", bailleurHelpCenter, (href) => bailleurFamilyOf(href)],
  ["mandant", mandantHelpCenter, (href) => mandantFamilyOf(`/confie${href}`)],
];

describe.each(spaces)("aide de l'espace %s en mode api", (_name, help, familyOf) => {
  const articles = help.categories.flatMap((category) => category.articles);

  it("respecte le contrat de la messagerie", () => {
    expect(helpCenterSchema.safeParse(help).success).toBe(true);
  });

  it("n'a ni identifiant en double ni catégorie vide", () => {
    expect(new Set(articles.map((article) => article.id)).size).toBe(articles.length);
    expect(new Set(help.categories.map((category) => category.id)).size).toBe(help.categories.length);
    for (const category of help.categories) expect(category.articles.length, category.id).toBeGreaterThan(0);
  });

  it("ne renvoie que vers des écrans réels, avec un libellé", () => {
    const linked = articles.filter((article) => article.href !== undefined);
    expect(linked.length).toBeGreaterThan(0);
    for (const article of linked) {
      expect(familyOf(article.href ?? ""), article.id).toBeNull();
      expect(article.hrefLabel, article.id).toBeTruthy();
    }
  });

  it("n'affiche aucune donnée de démonstration ni contact inventé", () => {
    const text = JSON.stringify(help);
    for (const forbidden of ["example", "+33", "00 00", "Delmas", "Chevalier"]) expect(text).not.toContain(forbidden);
    expect(help.contact).toEqual([]);
    expect(help.emergency).toEqual([]);
  });
});

describe("date de mise à jour", () => {
  it("est une date valide", () => {
    expect(HELP_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(HELP_UPDATED_AT))).toBe(false);
  });
});

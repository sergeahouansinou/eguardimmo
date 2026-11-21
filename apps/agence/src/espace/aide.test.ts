import { helpCenterSchema } from "@eguardimmo/messagerie";
import { describe, expect, it } from "vitest";
import { AGENCE_HELP_UPDATED_AT, agenceHelpCenter } from "./aide";
import { unavailableFamilyOf } from "./capabilities";

const articles = agenceHelpCenter.categories.flatMap((category) => category.articles);

describe("aide de l'agence en mode api", () => {
  it("respecte le contrat de la messagerie et porte une date de mise à jour", () => {
    expect(helpCenterSchema.safeParse(agenceHelpCenter).success).toBe(true);
    expect(AGENCE_HELP_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(AGENCE_HELP_UPDATED_AT))).toBe(false);
  });

  it("n'a ni identifiant en double ni catégorie vide", () => {
    expect(new Set(articles.map((article) => article.id)).size).toBe(articles.length);
    expect(new Set(agenceHelpCenter.categories.map((category) => category.id)).size).toBe(agenceHelpCenter.categories.length);
    for (const category of agenceHelpCenter.categories) expect(category.articles.length, category.id).toBeGreaterThan(0);
  });

  it("ne renvoie que vers des écrans réels, avec un libellé", () => {
    const linked = articles.filter((article) => article.href !== undefined);
    expect(linked.length).toBeGreaterThan(0);
    for (const article of linked) {
      expect(unavailableFamilyOf(article.href ?? ""), article.id).toBeNull();
      expect(article.hrefLabel, article.id).toBeTruthy();
    }
  });

  it("n'affiche aucune donnée de démonstration ni contact inventé", () => {
    const text = JSON.stringify(agenceHelpCenter);
    for (const forbidden of ["example", "+33", "00 00", "Delmas", "Chevalier"]) expect(text).not.toContain(forbidden);
    expect(agenceHelpCenter.contact).toEqual([]);
    expect(agenceHelpCenter.emergency).toEqual([]);
  });
});

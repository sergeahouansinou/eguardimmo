import { describe, expect, it } from "vitest";
import { isInternal, resolves, routePatterns, sourceHrefs } from "../../test/liens";
import { ROUTES } from "./routes";

const patterns = routePatterns();

describe("liens de l'application d'authentification", () => {
  it("connaît les pages livrées", () => {
    expect(patterns.length).toBeGreaterThan(10);
  });

  it("chaque route déclarée dans ROUTES correspond à une page", () => {
    const orphelines = Object.values(ROUTES).filter((href) => !resolves(href, patterns));
    expect(orphelines).toEqual([]);
  });

  it("chaque lien interne du code source correspond à une page", () => {
    const orphelins = sourceHrefs().filter(({ href }) => isInternal(href) && !resolves(href, patterns));
    expect(orphelins).toEqual([]);
  });

});

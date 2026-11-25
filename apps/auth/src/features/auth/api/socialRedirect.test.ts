import { describe, expect, it } from "vitest";
import { setup } from "./testing";

const RETOUR = "http://localhost:3020/tableau";

function redirection(input: Parameters<NonNullable<ReturnType<typeof setup>["source"]["socialRedirectUrl"]>>[0]) {
  const url = setup([]).source.socialRedirectUrl?.(input);
  if (url === undefined || url === null) return null;
  const parsed = new URL(url);
  return { origine: parsed.origin, chemin: parsed.pathname, requete: Object.fromEntries(parsed.searchParams) };
}

describe("source API : redirection sociale", () => {
  it("construit l’adresse de connexion avec le fournisseur et l’adresse de retour", () => {
    expect(redirection({ provider: "google", intent: "connexion", returnTo: RETOUR })).toEqual({
      origine: "https://api.test",
      chemin: "/auth/social/google/redirect",
      requete: { intent: "login", return_to: RETOUR },
    });
  });

  it("omet l’adresse de retour quand il n’y en a pas", () => {
    expect(redirection({ provider: "apple", intent: "connexion", returnTo: null })).toEqual({
      origine: "https://api.test",
      chemin: "/auth/social/apple/redirect",
      requete: { intent: "login" },
    });
  });

  it.each([
    ["bailleur", "individual_landlord"],
    ["agence", "agency"],
    ["voyageur", "traveler"],
  ] as const)("transmet le profil %s de l’inscription sous le nom %s", (profile, attendu) => {
    expect(redirection({ provider: "google", intent: "inscription", profile, returnTo: null })?.requete).toEqual({
      intent: "register",
      profile: attendu,
    });
  });

  it("refuse une inscription sans profil", () => {
    expect(redirection({ provider: "google", intent: "inscription", returnTo: null })).toBeNull();
  });
});

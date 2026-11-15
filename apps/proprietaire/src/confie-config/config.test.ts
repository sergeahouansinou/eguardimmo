import { describe, expect, it } from "vitest";
import { accountMenu, notifications } from "./config";

describe("menu du compte propriétaire mandant", () => {
  it("renvoie vers l'application d'authentification pour changer d'espace et se déconnecter", () => {
    expect(accountMenu.switchSpace?.href).toBe("http://localhost:3040/profils");
    expect(accountMenu.signOut.href).toBe("http://localhost:3040/deconnecte");
  });

  it("sépare le centre de notifications des préférences", () => {
    expect(notifications).toEqual({ allHref: "/notifications/toutes", settingsHref: "/notifications" });
  });
});

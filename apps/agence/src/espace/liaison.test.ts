import { describe, expect, it } from "vitest";
import { accountMenu, notifications, plannedScreens } from "./config";

describe("liaison de l'espace agence avec les autres applications", () => {
  it("change d'espace et se déconnecte via l'application d'authentification", () => {
    expect(accountMenu.switchSpace?.href).toBe("http://localhost:3040/profils");
    expect(accountMenu.signOut.href).toBe("http://localhost:3040/deconnecte");
  });

  it("le centre de notifications est livré et distinct des préférences du compte", () => {
    expect(notifications).toEqual({ allHref: "/notifications", settingsHref: "/compte/notifications" });
    expect(plannedScreens.has("/notifications")).toBe(false);
    expect(plannedScreens.has("/choix-du-profil")).toBe(false);
    expect(plannedScreens.has("/deconnexion")).toBe(false);
  });
});

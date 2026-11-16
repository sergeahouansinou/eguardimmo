import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetVerificationEmail, rememberVerificationEmail } from "./pendingVerification";

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("adresse en attente de vérification", () => {
  it("la garde en sessionStorage, jamais dans l’URL, puis l’oublie", () => {
    rememberVerificationEmail("  jeanne@exemple.fr ");

    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem(window.sessionStorage.key(0) ?? "")).toBe("jeanne@exemple.fr");
    expect(window.location.href).not.toContain("jeanne");

    forgetVerificationEmail();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("ignore un stockage indisponible sans lever d’erreur", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("plein", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("bloqué", "SecurityError");
    });

    expect(() => { rememberVerificationEmail("jeanne@exemple.fr"); }).not.toThrow();
    expect(() => { forgetVerificationEmail(); }).not.toThrow();
  });
});

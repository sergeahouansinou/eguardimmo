import { describe, expect, it } from "vitest";
import { homeUrlOfApp, isInternalPath, parseReturnTo } from "./returnTo";

const HOSTS = ["agence.eguardimmo.test", "proprietaire.eguardimmo.test", "localhost:3030", "sebook.eguardimmo.com"];

describe("parseReturnTo", () => {
  it("accepte un hôte de la liste blanche et reconnaît l’espace", () => {
    const result = parseReturnTo("http://agence.eguardimmo.test/baux?tri=date", HOSTS);
    expect(result).toEqual({ status: "ok", url: "http://agence.eguardimmo.test/baux?tri=date", host: "agence.eguardimmo.test", app: "agence" });
  });

  it("accepte localhost avec son port et https pour un domaine public", () => {
    expect(parseReturnTo("http://localhost:3030/", HOSTS).status).toBe("ok");
    expect(parseReturnTo("https://sebook.eguardimmo.com/sejours", HOSTS)).toMatchObject({ status: "ok", app: "sebook" });
  });

  it("traite l’absence de paramètre comme un état distinct", () => {
    expect(parseReturnTo(null, HOSTS)).toEqual({ status: "absent" });
    expect(parseReturnTo("  ", HOSTS)).toEqual({ status: "absent" });
  });

  it.each([
    ["https://evil.example/", "https://evil.example"],
    ["https://agence.eguardimmo.test.evil.example/", "https://agence.eguardimmo.test.evil.example"],
    ["https://evil.example@agence.eguardimmo.test/", "https://agence.eguardimmo.test"],
    ["https://user:secret@agence.eguardimmo.test/", "https://agence.eguardimmo.test"],
    ["http://sebook.eguardimmo.com/", "http://sebook.eguardimmo.com"],
    ["http://localhost:9999/", "http://localhost:9999"],
    ["https://agence.eguardimmo.test:8443/", "https://agence.eguardimmo.test:8443"],
    ["javascript:alert(1)", null],
    ["//evil.example/", null],
    ["/chemin-relatif", null],
    ["https:\\\\evil.example", "https://evil.example"],
  ])("refuse %s", (raw, origin) => {
    expect(parseReturnTo(raw, HOSTS)).toEqual({ status: "refused", origin });
  });

  it("refuse tout quand la liste blanche est vide", () => {
    expect(parseReturnTo("https://agence.eguardimmo.test/", []).status).toBe("refused");
  });
});

describe("isInternalPath", () => {
  it.each(["/profils", "/compte/securite?confirme=1"])("accepte %s", (path) => {
    expect(isInternalPath(path)).toBe(true);
  });

  it.each([null, undefined, "", "profils", "//evil.example", "/\\evil.example", "https://evil.example", "/a\nb"])("refuse %s", (path) => {
    expect(isInternalPath(path)).toBe(false);
  });
});

describe("homeUrlOfApp", () => {
  it("compose l’adresse d’accueil d’un espace", () => {
    expect(homeUrlOfApp("agence", HOSTS)).toBe("https://agence.eguardimmo.test/".replace("https", "http"));
    expect(homeUrlOfApp("locataire", HOSTS)).toBe("http://localhost:3030/");
    expect(homeUrlOfApp("sebook", HOSTS)).toBe("https://sebook.eguardimmo.com/");
  });

  it("renvoie null pour un espace non configuré", () => {
    expect(homeUrlOfApp("agence", ["localhost:3030"])).toBeNull();
  });
});

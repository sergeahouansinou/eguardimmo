import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("sépare par point-virgule et ferme chaque ligne par CRLF", () => {
    expect(toCsv(["Nom", "Loyer"], [["Anaïs Roux", "450.00"]])).toBe("Nom;Loyer\r\nAnaïs Roux;450.00");
  });

  it("protège les cellules contenant séparateur, guillemet ou retour à la ligne", () => {
    expect(toCsv(["A"], [['dit "oui"; puis non']])).toBe('A\r\n"dit ""oui""; puis non"');
  });

  it("neutralise les formules mais garde les montants négatifs lisibles", () => {
    expect(toCsv(["A"], [["=SOMME(A1)"], ["@cmd"], ["+33 6"], ["-450.00"]])).toBe("A\r\n'=SOMME(A1)\r\n'@cmd\r\n'+33 6\r\n-450.00");
  });
});

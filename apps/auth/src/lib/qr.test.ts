import { describe, expect, it } from "vitest";
import { encodeQr } from "./qr";

const OTPAUTH = "otpauth://totp/eGuardImmo:marc.dossou@example.com?secret=JBSWY3DPEHPK3PXP&issuer=eGuardImmo";

function finderAt(matrix: boolean[][], x: number, y: number): boolean {
  const rows = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];
  return rows.every((row, dy) => row.split("").every((cell, dx) => matrix[y + dy]?.[x + dx] === (cell === "1")));
}

describe("encodeQr", () => {
  it("produit une matrice carrée de taille 17 + 4 × version", () => {
    expect(encodeQr("A")).toHaveLength(21);
    expect(encodeQr(OTPAUTH)).toHaveLength(41);
    expect(encodeQr("x".repeat(213))).toHaveLength(57);
  });

  it("pose les trois motifs de repérage", () => {
    const matrix = encodeQr(OTPAUTH);
    const last = matrix.length - 7;
    expect(finderAt(matrix, 0, 0)).toBe(true);
    expect(finderAt(matrix, last, 0)).toBe(true);
    expect(finderAt(matrix, 0, last)).toBe(true);
  });

  it("pose la ligne de synchronisation alternée", () => {
    const matrix = encodeQr(OTPAUTH);
    for (let i = 8; i < matrix.length - 8; i++) {
      expect(matrix[6]?.[i]).toBe(i % 2 === 0);
      expect(matrix[i]?.[6]).toBe(i % 2 === 0);
    }
  });

  it("est déterministe et dépend du contenu", () => {
    expect(encodeQr(OTPAUTH)).toEqual(encodeQr(OTPAUTH));
    expect(encodeQr(OTPAUTH)).not.toEqual(encodeQr(`${OTPAUTH}x`));
  });

  it("refuse un contenu trop long", () => {
    expect(() => encodeQr("x".repeat(400))).toThrow(RangeError);
  });
});

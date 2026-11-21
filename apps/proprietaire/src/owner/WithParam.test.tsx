import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Resolved } from "./WithParam";

const UUID = "0193a5e1-0000-7000-8000-0000000000b1";
const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/;

describe("WithParam", () => {
  it("rend le contenu pour un identifiant valide", async () => {
    const element = await Resolved({ params: Promise.resolve({ id: UUID }), name: "id", children: (value) => `bien ${value}` });

    render(element);

    expect(screen.getByText(`bien ${UUID}`)).toBeTruthy();
  });

  it.each(["apt-12", "../etc", "0193a5e1", `${UUID}/x`])("répond 404 pour l’identifiant invalide %s", async (id) => {
    await expect(Resolved({ params: Promise.resolve({ id }), name: "id", children: () => null })).rejects.toThrow(NOT_FOUND);
  });

  it("accepte un mois valide et refuse un mois hors calendrier", async () => {
    const valid = await Resolved({ params: Promise.resolve({ month: "2026-11" }), name: "month", children: (value) => value });

    render(valid);

    expect(screen.getByText("2026-11")).toBeTruthy();
    for (const month of ["2026-13", "2026-00", "26-11", "2026-1"]) {
      await expect(Resolved({ params: Promise.resolve({ month }), name: "month", children: () => null })).rejects.toThrow(NOT_FOUND);
    }
  });
});

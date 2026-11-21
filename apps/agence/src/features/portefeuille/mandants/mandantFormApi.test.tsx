import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderPortefeuille } from "../testing";
import { MandantFormPage } from "./MandantFormPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());
vi.mock("@/lib/env", () => ({ dataSource: "api", apiEnv: () => ({}) }));

describe("nouveau mandant en mode api", () => {
  it("annonce que la création n'est pas reliée au lieu d'ouvrir un formulaire de démonstration", () => {
    renderPortefeuille(<MandantFormPage />);

    expect(screen.getByText("Création de mandant non disponible")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Enregistrer/ })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /E-mail/ })).toBeNull();
  });
});

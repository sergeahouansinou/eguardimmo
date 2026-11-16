import { useShellSource } from "@eguardimmo/shell";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
}));

function Probe() {
  const source = useShellSource();
  return <p>{typeof source.shell}</p>;
}

describe("fournisseurs de l'application selon la source de données", () => {
  it("ne fournit aucune source de coquille de démonstration en mode api", () => {
    state.mode = "api";
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <Providers>
          <Probe />
        </Providers>,
      ),
    ).toThrow("ShellSourceProvider manquant");
  });

  it("fournit la coquille de démonstration en mode démo", () => {
    state.mode = "demo";

    render(
      <Providers>
        <Probe />
      </Providers>,
    );

    expect(screen.getByText("function")).toBeTruthy();
  });
});

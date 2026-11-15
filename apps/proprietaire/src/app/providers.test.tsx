import { useToast } from "@eguardimmo/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Providers } from "./providers";

function Probe() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => { show({ title: "Enregistré" }); }}>
      Notifier
    </button>
  );
}

describe("fournisseurs de l'application", () => {
  it("fournissent un ToastProvider global à toutes les pages", async () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Notifier" }));
    expect(await screen.findByText("Enregistré")).toBeTruthy();
  });
});

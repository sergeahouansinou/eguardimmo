import { ShellSourceProvider, shellSchema } from "@eguardimmo/shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createDemoSource } from "@/espace/demo";
import { expectNoA11yViolations } from "../../../test/axe";
import { CentreNotifications } from "./CentreNotifications";

function renderCentre() {
  const source = createDemoSource();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ShellSourceProvider source={source}>
        <CentreNotifications />
      </ShellSourceProvider>
    </QueryClientProvider>,
  );
  return { ...view, source };
}

describe("centre de notifications de l'agence", () => {
  it("liste les notifications avec leur lien et renvoie vers les préférences du compte", async () => {
    const { container } = renderCentre();
    const list = await screen.findByRole("list", { name: "Notifications" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("link", { name: /Assurance RCP/ }).getAttribute("href")).toBe("/conformite");
    expect(screen.getByRole("link", { name: "Préférences" }).getAttribute("href")).toBe("/compte/notifications");
    await expectNoA11yViolations(container);
  });

  it("marque une notification puis toutes comme lues dans la source", async () => {
    const user = userEvent.setup();
    const { source } = renderCentre();
    const unread = async () => shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread).length;
    expect(await unread()).toBe(2);
    await user.click(await screen.findByRole("button", { name: "Marquer comme lue : Assurance RCP à renouveler" }));
    await waitFor(async () => { expect(await unread()).toBe(1); });
    await user.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    await waitFor(async () => { expect(await unread()).toBe(0); });
  });

  it("refuse de marquer une notification inconnue", async () => {
    const source = createDemoSource();
    await expect(source.markNotificationRead?.("inconnue")).rejects.toThrow("inconnue");
  });
});

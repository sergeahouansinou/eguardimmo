import { createDemoSource } from "@eguardimmo/gestion";
import { ShellSourceProvider, shellSchema } from "@eguardimmo/shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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

describe("centre de notifications du bailleur", () => {
  it("liste les notifications avec leur lien et renvoie vers les réglages de notification", async () => {
    const { container } = renderCentre();
    const list = await screen.findByRole("list", { name: "Notifications" });
    expect(within(list).getByRole("link", { name: /Loyer de novembre impayé/ }).getAttribute("href")).toBe("/finances/impayes");
    expect(screen.getByRole("link", { name: "Préférences" }).getAttribute("href")).toBe("/reglages/notifications");
    await expectNoA11yViolations(container);
  });

  it("marque une notification puis toutes comme lues dans la source", async () => {
    const user = userEvent.setup();
    const { source } = renderCentre();
    const unread = async () => shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread).length;
    expect(await unread()).toBe(3);
    await user.click(await screen.findByRole("button", { name: "Marquer comme lue : Loyer de novembre impayé" }));
    await waitFor(async () => { expect(await unread()).toBe(2); });
    await user.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    await waitFor(async () => { expect(await unread()).toBe(0); });
  });
});

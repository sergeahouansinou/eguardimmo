import { shellSchema } from "@eguardimmo/shell";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/axe";
import { renderWithSpace } from "../test/render";
import { NotificationsCentreScreen } from "./NotificationsCentreScreen";

describe("centre de notifications du mandant", () => {
  it("liste les notifications avec leurs liens réels et renvoie vers les préférences", async () => {
    const { container } = renderWithSpace(<NotificationsCentreScreen />);
    const list = await screen.findByRole("list", { name: "Notifications" });
    const hrefs = within(list).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((href) => href?.startsWith("/confie/"))).toBe(true);
    expect(screen.getByRole("link", { name: "Préférences" }).getAttribute("href")).toBe("/confie/notifications");
    await expectNoA11yViolations(container);
  });

  it("marque une notification puis toutes comme lues dans la source", async () => {
    const user = userEvent.setup();
    const { source } = renderWithSpace(<NotificationsCentreScreen />);
    const unread = async () => shellSchema.parse(await source.shell()).notifications.filter((item) => item.unread).length;
    const before = await unread();
    expect(before).toBeGreaterThan(1);
    const [button] = await screen.findAllByRole("button", { name: /^Marquer comme lue :/ });
    if (!button) throw new Error("aucun bouton de marquage");
    await user.click(button);
    await waitFor(async () => { expect(await unread()).toBe(before - 1); });
    await user.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    await waitFor(async () => { expect(await unread()).toBe(0); });
  });
});

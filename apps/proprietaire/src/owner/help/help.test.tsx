import { SupportProvider, createSupportApiSource } from "@eguardimmo/messagerie";
import { screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { mandantHelpCenter } from "@/features/aide/helpContent";
import { ownerSupportRoutes } from "../support/OwnerSupportProvider";
import { useOwnerSession } from "../session";
import { AideScreen } from "./AideScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const DEMO_TEXTS = ["Sophie Delmas", "Delmas Immobilier", "+33", "Koffi Adjovi"];

beforeEach(() => {
  setLocation("/confie/aide");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function WithSupport({ children }: { children: ReactElement }) {
  const { client } = useOwnerSession();
  return (
    <SupportProvider space="owner" source={createSupportApiSource({ client, space: "owner" })} routes={ownerSupportRoutes} Link={({ href, children: content, ...props }) => <a href={href} {...props}>{content}</a>} navigate={() => undefined}>
      {children}
    </SupportProvider>
  );
}

const mount = () => renderApi(<WithSupport><AideScreen /></WithSupport>);

describe("aide du propriétaire en mode api", () => {
  it("affiche les questions fréquentes de l’espace sans donnée d’exemple ni appel au serveur", async () => {
    const api = stubApi();
    const { container } = mount();

    expect(await screen.findByRole("heading", { level: 1, name: "Aide" })).toBeTruthy();
    for (const category of mandantHelpCenter.categories) expect(await screen.findByRole("region", { name: category.title })).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(api.calls.map((call) => call.path)).toEqual(["/api/v1/owner/agencies"]);
    await expectNoA11yViolations(container);
  });

  it("déplie une réponse et mène à l’écran réel de /confie", async () => {
    stubApi();
    const { user } = mount();

    const question = await screen.findByRole("button", { name: "Où voir mes loyers et mes reversements ?" });
    expect(question.getAttribute("aria-expanded")).toBe("false");
    await user.click(question);

    expect(question.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Ouvrir Loyers" }).getAttribute("href")).toBe("/confie/loyers");
  });

  it("propose d’écrire à l’agence et au support par les écrans réels", async () => {
    stubApi();
    mount();

    const contact = await screen.findByRole("complementary", { name: "Nous contacter" });
    expect(within(contact).getByRole("link", { name: /Écrire à l’agence/ }).getAttribute("href")).toBe("/confie/messages/nouveau");
    expect(within(contact).getByRole("link", { name: /Écrire au support/ }).getAttribute("href")).toBe("/confie/support/nouvelle");
    expect(within(contact).queryByRole("term")).toBeNull();
  });

  it("filtre les réponses et annonce l’absence de résultat", async () => {
    stubApi();
    const { user } = mount();

    await user.type(await screen.findByRole("searchbox", { name: "Rechercher dans l’aide" }), "fiscaux");
    expect(screen.queryByRole("button", { name: "Que puis-je consulter dans mon espace ?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Où trouver mes relevés fiscaux ?" })).toBeTruthy();

    await user.clear(screen.getByRole("searchbox", { name: "Rechercher dans l’aide" }));
    await user.type(screen.getByRole("searchbox", { name: "Rechercher dans l’aide" }), "zzzzzz");
    expect(await screen.findByText("Aucune réponse ne correspond")).toBeTruthy();
  });
});

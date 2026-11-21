import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import { TransmissionDownloadScreen } from "./TransmissionDownloadScreen";

vi.mock("@/lib/env", () => ({
  dataSource: "api",
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_DATA_SOURCE: "api", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040" }),
}));

const TOKEN = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC2dE4fG6hJ8kL0mN2pQ4";
const LINK_URL = `https://api.test/api/v1/recovery/downloads/${TOKEN}`;

const zip = () => new Response("PK-fixture-zip", { status: 200, headers: { "Content-Type": "application/zip" } });
const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ status, code, ...extra }), { status, headers: { "Content-Type": "application/problem+json" } });

let fetchMock: MockInstance<typeof fetch>;
let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let downloads: string[];
let consoleSpies: MockInstance[];

const consoleOutput = (): string => consoleSpies.flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, "fetch");
  createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:zip");
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
  downloads = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) { downloads.push(this.download); });
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const clickDownload = async () => { await userEvent.click(await screen.findByRole("button", { name: /^Télécharger/ })); };

describe("page publique de téléchargement du lien", () => {
  it("propose le téléchargement sans rien demander ni appeler le serveur avant le clic", async () => {
    const { container } = render(<TransmissionDownloadScreen urlToken={TOKEN} />);

    expect(await screen.findByRole("heading", { name: "Pièces d’un dossier de recouvrement" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Télécharger le dossier (ZIP)" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("télécharge le ZIP sans cookie et confirme, jamais le jeton à l’écran", async () => {
    fetchMock.mockResolvedValue(zip());
    render(<TransmissionDownloadScreen urlToken={TOKEN} />);

    await clickDownload();

    expect(await screen.findByText("Téléchargement lancé")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(LINK_URL);
    expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe("application/zip");
    expect(downloads).toEqual(["dossier-recouvrement.zip"]);
    expect(screen.getByRole("button", { name: "Télécharger à nouveau" })).toBeTruthy();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(consoleOutput()).not.toContain(TOKEN);
  });

  it("répond « Lien invalide ou expiré » pour tout 404, sans révéler pourquoi", async () => {
    fetchMock.mockResolvedValue(problem(404, "recovery_link_not_found"));
    const { container } = render(<TransmissionDownloadScreen urlToken={TOKEN} />);

    await clickDownload();

    expect(await screen.findByRole("heading", { name: "Lien invalide ou expiré" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Télécharger/ })).toBeNull();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(consoleOutput()).not.toContain(TOKEN);
    expect(createObjectURL).not.toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("refuse sans appel un jeton mal formé avec le même message", async () => {
    render(<TransmissionDownloadScreen urlToken="abc" />);

    expect(await screen.findByRole("heading", { name: "Lien invalide ou expiré" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invite à patienter après un 429 et laisse réessayer", async () => {
    fetchMock.mockResolvedValueOnce(problem(429, "too_many_requests", { retry_after: 60 })).mockResolvedValueOnce(zip());
    render(<TransmissionDownloadScreen urlToken={TOKEN} />);

    await clickDownload();

    expect(await screen.findByText("Trop de tentatives")).toBeTruthy();
    expect(screen.getByText("Patientez 60 secondes avant de réessayer.")).toBeTruthy();
    await clickDownload();
    expect(await screen.findByText("Téléchargement lancé")).toBeTruthy();
    expect(screen.queryByText("Trop de tentatives")).toBeNull();
  });

  it("signale un serveur injoignable sans perdre le lien", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    render(<TransmissionDownloadScreen urlToken={TOKEN} />);

    await clickDownload();

    expect(await screen.findByText("Serveur injoignable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Télécharger le dossier (ZIP)" })).toBeTruthy();
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it("signale une indisponibilité du serveur", async () => {
    fetchMock.mockResolvedValue(problem(503, "recovery_bundle_unavailable"));
    render(<TransmissionDownloadScreen urlToken={TOKEN} />);

    await clickDownload();

    expect(await screen.findByText("Téléchargement indisponible")).toBeTruthy();
    await waitFor(() => { expect(screen.getByRole<HTMLButtonElement>("button", { name: /^Télécharger/ }).disabled).toBe(false); });
  });
});

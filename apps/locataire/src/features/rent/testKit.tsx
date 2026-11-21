import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { leasePage, summary } from "@/tenant/responses.fixtures";
import { REAL_IDS } from "@/tenant/rentResponses.fixtures";

export const RENT = "/api/v1/tenant/rent";
export const LEASES_STUB = { "GET /api/v1/tenant/leases": { body: leasePage([summary({ id: REAL_IDS.lease, reference: "BL-2026-99809" })]) } };
export const DEMO_TEXTS = ["Koffi Adjovi", "Les Tilleuls", "Cabinet Delmas", "Apt A1", "Mutuelle Horizon", "Sophie Delmas"];

export const clone = <T,>(value: T): T => structuredClone(value);

export function problem(status: number, code: string, detail: string) {
  return { type: `https://eguardimmo.test/problems/${code}`, title: detail, status, code, detail };
}

export interface SavedFile {
  download: string;
  href: string;
}

export function captureDownloads(): SavedFile[] {
  const saved: SavedFile[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) {
    saved.push({ download: this.download, href: this.href });
  });
  return saved;
}

export async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: new RegExp(field) }));
  await user.click(await screen.findByRole("option", { name: option }));
}

export function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Élément ${String(index)} absent`);
  return item;
}

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSupportBadges } from "./useSupportBadges";

const state = vi.hoisted((): { requests: number | undefined; summary: { pending: number; emergencies: unknown[] } | undefined } => ({ requests: undefined, summary: undefined }));

vi.mock("@eguardimmo/messagerie", () => ({
  useSupportUnread: () => state.requests,
  useAccessSummary: () => state.summary,
}));

beforeEach(() => {
  state.requests = undefined;
  state.summary = undefined;
});

describe("pastilles du support dans la navigation", () => {
  it("ne compte rien tant que le serveur n'a pas répondu", () => {
    expect(renderHook(() => useSupportBadges()).result.current).toEqual({ requests: undefined, access: undefined });
  });

  it("compte les réponses à lire, et les demandes d'accès en attente avec les urgences en cours", () => {
    state.requests = 2;
    state.summary = { pending: 1, emergencies: [{}, {}] };

    expect(renderHook(() => useSupportBadges()).result.current).toEqual({ requests: 2, access: 3 });
  });
});

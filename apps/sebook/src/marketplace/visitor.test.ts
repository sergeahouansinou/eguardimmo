import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { visitorIp } from "./visitor";

const forwarded = (value: string) => vi.mocked(headers).mockResolvedValueOnce(new Headers({ "x-forwarded-for": value }));

describe("adresse du visiteur", () => {
  it.each(["203.0.113.7", "2001:db8:1:2::9"])("lit %s dans X-Forwarded-For", async (ip) => {
    forwarded(ip);
    expect(await visitorIp()).toBe(ip);
  });

  it("ne retient que la dernière entrée, écrite par le proxy", async () => {
    forwarded("198.51.100.1, 203.0.113.7");
    expect(await visitorIp()).toBe("203.0.113.7");
  });

  it.each(["", "inconnue", "203.0.113.7, ", "203.0.113.7:443"])("rejette %o", async (value) => {
    forwarded(value);
    expect(await visitorIp()).toBeNull();
  });

  it("sans en-tête, aucune adresse", async () => {
    expect(await visitorIp()).toBeNull();
  });
});

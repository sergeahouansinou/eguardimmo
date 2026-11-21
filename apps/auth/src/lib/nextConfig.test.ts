import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function rules() {
  if (nextConfig.headers === undefined) throw new Error("headers absents de la configuration Next");
  return nextConfig.headers();
}

describe("en-têtes de apps/auth", () => {
  it("garde la politique de référent habituelle partout", async () => {
    const all = (await rules()).find((rule) => rule.source === "/:path*");
    expect(all?.headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" });
  });

  it("coupe le référent sur la page d’invitation propriétaire, après la règle générale pour qu’elle l’emporte", async () => {
    const list = await rules();
    const index = list.findIndex((rule) => rule.source === "/invitation-proprietaire/:path*");

    expect(index).toBeGreaterThan(list.findIndex((rule) => rule.source === "/:path*"));
    expect(list[index]?.headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
  });
});

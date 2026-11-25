import { describe, expect, it } from "vitest";
import { sebookEnvSchema } from "./env";

const VALID = { NEXT_PUBLIC_API_URL: "https://api.sebook.test", NEXT_PUBLIC_DATA_SOURCE: "api", NEXT_PUBLIC_AUTH_URL: "https://auth.sebook.test", NEXT_PUBLIC_SITE_URL: "https://sebook.test" };

function issues(env: Record<string, string>, nodeEnv: string) {
  const result = sebookEnvSchema(nodeEnv).safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`);
}

describe("environnement SeBook", () => {
  it("accepte des URL https en production", () => {
    expect(issues(VALID, "production")).toEqual([]);
  });

  it.each(["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SITE_URL"])("refuse %s en http en production", (key) => {
    expect(issues({ ...VALID, [key]: "http://exemple.test" }, "production")).toEqual([`${key} : ${key} doit être en https en production.`]);
  });

  it("refuse localhost en http en production", () => {
    expect(issues({ ...VALID, NEXT_PUBLIC_API_URL: "http://localhost:8000" }, "production")).toHaveLength(1);
  });

  it("garde http et localhost en développement et en test", () => {
    const local = { ...VALID, NEXT_PUBLIC_API_URL: "http://localhost:8000", NEXT_PUBLIC_SITE_URL: "http://localhost:3060" };
    expect(issues(local, "development")).toEqual([]);
    expect(issues(local, "test")).toEqual([]);
  });
});

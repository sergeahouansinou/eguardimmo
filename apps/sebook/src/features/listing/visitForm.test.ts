import { describe, expect, it } from "vitest";
import { visitIssue, visitSchema } from "./visitForm";

describe("visitSchema", () => {
  it("accepte un créneau avec ou sans message, rognés", () => {
    expect(visitSchema.parse({ desiredSlot: "  samedi 10 h ", message: "" })).toEqual({ desiredSlot: "samedi 10 h", message: "" });
    expect(visitSchema.parse({ desiredSlot: "x".repeat(120), message: "m".repeat(1000) }).message).toHaveLength(1000);
  });

  it.each([
    [{ desiredSlot: "   ", message: "" }, "slotRequired"],
    [{ desiredSlot: "x".repeat(121), message: "" }, "slotTooLong"],
    [{ desiredSlot: "ok", message: "m".repeat(1001) }, "messageTooLong"],
  ])("refuse %j", (values, issue) => {
    const result = visitSchema.safeParse(values);
    expect(result.success).toBe(false);
    expect(visitIssue(result.error?.issues[0]?.message)).toBe(issue);
  });

  it("ignore un message d’erreur inconnu", () => {
    expect(visitIssue("autre")).toBeNull();
    expect(visitIssue(undefined)).toBeNull();
  });
});

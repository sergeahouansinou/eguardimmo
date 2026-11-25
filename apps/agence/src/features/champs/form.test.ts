import { describe, expect, it } from "vitest";
import { buildPayload, emptyForm, fieldFormSchema, formFromField, slugify } from "./form";
import type { CustomField } from "./schemas";

const existing: CustomField = {
  id: "cf",
  entity: "unit",
  key: "exposition",
  labels: { fr: "Exposition", en: "Aspect" },
  type: "select",
  vocabulary: null,
  options: [{ key: "nord", labels: { fr: "Nord", en: "North" } }],
  required: false,
  position: 1,
  typeLocked: false,
  archived: false,
};

describe("formulaire de champ personnalisé", () => {
  it("dérive une clé d’option sans accent ni symbole", () => {
    expect(slugify("Est ou ouest !")).toBe("est_ou_ouest");
    expect(slugify("Été / Hiver")).toBe("ete_hiver");
    expect(slugify("???")).toBe("");
  });

  it("conserve les libellés des autres langues à la modification", () => {
    const values = { ...formFromField(existing), label: "Orientation", options: [{ key: "nord", label: "Septentrion" }, { key: "", label: "Plein sud" }] };
    const payload = buildPayload(values, existing);
    expect(payload).not.toHaveProperty("key");
    expect(payload.labels).toEqual({ fr: "Orientation", en: "Aspect" });
    expect(payload.options).toEqual([
      { key: "nord", labels: { fr: "Septentrion", en: "North" } },
      { key: "plein_sud", labels: { fr: "Plein sud" } },
    ]);
  });

  it("envoie la clé à la création et vide ce qui ne concerne pas le type", () => {
    const text = buildPayload({ ...emptyForm(), label: "Code", key: "code", vocabulary: "unit_type", options: [{ key: "", label: "x" }] });
    expect(text).toMatchObject({ key: "code", vocabulary: null, options: null, required: false });
    const term = buildPayload({ ...emptyForm(), label: "Forme", key: "forme", type: "term", vocabulary: "legal_form" });
    expect(term.vocabulary).toBe("legal_form");
  });

  it("valide clé, référentiel et options", () => {
    const schema = fieldFormSchema(false);
    const issues = (values: object) => {
      const result = schema.safeParse({ ...emptyForm(), label: "Code", key: "code", ...values });
      return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
    };
    expect(issues({})).toEqual([]);
    expect(issues({ key: "Code d'accès" })[0]).toMatch(/^key:/);
    expect(issues({ type: "term" })[0]).toMatch(/^vocabulary:/);
    expect(issues({ type: "select" })).toEqual(["options:Ajoutez au moins une option."]);
    expect(issues({ type: "multiselect", options: [{ key: "", label: "Nord" }, { key: "nord", label: "Nord bis" }] })).toEqual(["options.1.label:Deux options portent le même nom."]);
    expect(fieldFormSchema(true).safeParse({ ...emptyForm(), label: "Code", key: "ANCIENNE-CLE" }).success).toBe(true);
  });
});

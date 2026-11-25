import { OrgApiError } from "@/features/org/errors";
import type { ChampsSource } from "./source";
import type { CustomField, Entity, FieldPayload } from "./schemas";

function field(id: string, entity: Entity, key: string, label: string, position: number, rest: Partial<CustomField> = {}): CustomField {
  return { id, entity, key, labels: { fr: label }, type: "text", vocabulary: null, options: [], required: false, position, typeLocked: false, archived: false, ...rest };
}

const option = (key: string, label: string) => ({ key, labels: { fr: label } });

const SEEDS: readonly CustomField[] = [
  field("cf-unit-1", "unit", "code_acces", "Code d’accès", 1, { typeLocked: true }),
  field("cf-unit-2", "unit", "exposition", "Exposition", 2, { type: "select", options: [option("nord", "Nord"), option("sud", "Sud"), option("est_ouest", "Est ou ouest")], typeLocked: true }),
  field("cf-unit-3", "unit", "loyer_charge_ref", "Loyer de référence", 3, { type: "money", required: true }),
  field("cf-unit-4", "unit", "ancien_numero", "Ancien numéro de lot", 4, { archived: true }),
  field("cf-property-1", "property", "annee_ravalement", "Année du dernier ravalement", 1, { type: "number" }),
  field("cf-property-2", "property", "gardien", "Gardien présent", 2, { type: "bool" }),
  field("cf-party-1", "party", "forme_juridique", "Forme juridique", 1, { type: "term", vocabulary: "legal_form", required: true }),
  field("cf-party-2", "party", "site_web", "Site web", 2, { type: "url" }),
  field("cf-lease-1", "lease", "date_visite", "Date de la dernière visite", 1, { type: "date" }),
];

function conflict(code: string, message: string): OrgApiError {
  return new OrgApiError("conflict", message, { status: 409, code });
}

function missing(): OrgApiError {
  return new OrgApiError("not_found", "Ce champ n’existe plus dans votre organisation : rechargez la liste.", { status: 404, code: "custom_field_not_found" });
}

export function createDemoChamps(): ChampsSource {
  let fields: CustomField[] = SEEDS.map((seed) => ({ ...seed }));
  let counter = 100;
  const apply = (id: string, change: (current: CustomField) => CustomField): Promise<CustomField> => {
    const current = fields.find((candidate) => candidate.id === id);
    if (current === undefined) return Promise.reject(missing());
    try {
      const next = change(current);
      fields = fields.map((candidate) => (candidate.id === id ? next : candidate));
      return Promise.resolve({ ...next });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : missing());
    }
  };
  const lockedMessage = "Le type d’un champ ne change plus dès qu’une valeur existe, et ses options ne peuvent qu’être complétées.";
  const merge = (current: CustomField, payload: FieldPayload): CustomField => {
    if (current.typeLocked && payload.type !== current.type) throw conflict("custom_field_type_locked", lockedMessage);
    const dropsOption = payload.options !== null && current.options.some((old) => !payload.options?.some((item) => item.key === old.key));
    if (current.typeLocked && dropsOption) throw conflict("custom_field_type_locked", lockedMessage);
    return { ...current, labels: payload.labels, type: payload.type, vocabulary: payload.vocabulary, options: payload.options ?? [], required: payload.required };
  };
  return {
    list: (entity, includeArchived) =>
      Promise.resolve(
        fields
          .filter((candidate) => candidate.entity === entity && (includeArchived || !candidate.archived))
          .sort((a, b) => a.position - b.position)
          .map((candidate) => ({ ...candidate })),
      ),
    create: (entity, payload) => {
      if (fields.some((candidate) => candidate.entity === entity && candidate.key === payload.key)) {
        return Promise.reject(new OrgApiError("invalid", "Un champ de cet objet porte déjà cette clé.", { status: 422, code: "custom_field_key_taken", fieldErrors: { key: ["Un champ de cet objet porte déjà cette clé."] } }));
      }
      counter += 1;
      const created: CustomField = {
        id: `cf-${entity}-${String(counter)}`,
        entity,
        key: payload.key ?? "",
        labels: payload.labels,
        type: payload.type,
        vocabulary: payload.vocabulary,
        options: payload.options ?? [],
        required: payload.required,
        position: Math.max(0, ...fields.filter((candidate) => candidate.entity === entity).map((candidate) => candidate.position)) + 1,
        typeLocked: false,
        archived: false,
      };
      fields = [...fields, created];
      return Promise.resolve({ ...created });
    },
    update: (id, payload) => apply(id, (current) => merge(current, payload)),
    archive: (id) => apply(id, (current) => ({ ...current, archived: true })),
    restore: (id) => apply(id, (current) => ({ ...current, archived: false })),
  };
}

let shared: ChampsSource | null = null;

export function demoChamps(): ChampsSource {
  shared ??= createDemoChamps();
  return shared;
}

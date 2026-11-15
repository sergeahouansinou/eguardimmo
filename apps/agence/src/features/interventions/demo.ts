import type { z } from "zod";
import { WORKS_CEILING_MINOR } from "@/features/shared/agencyDefaults";
import { DEMO_NOW, DEMO_TODAY } from "@/features/shared/dates";
import { CURRENT_USER, lotById, mandantById } from "@/features/shared/directory";
import { DemoServerError } from "@/features/shared/errors";
import { formatMoney, splitVat, sum } from "@/features/shared/money";
import { createStore, slugify } from "@/features/shared/store";
import { contractorByName } from "./contractors";
import { seedDevis, seedInterventions } from "./data";
import type { RawDevis } from "./data";
import { PRIORITY_LABELS } from "./labels";
import { TRANSITIONS, TRANSITION_EVENTS } from "./rules";
import { createInterventionSchema, priorityChangeSchema, statusChangeSchema, submitDevisSchema } from "./schemas";
import type { Devis, Intervention, InterventionEvent } from "./schemas";
import type { InterventionsSource } from "./source";

function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fieldErrors: Record<string, string> = {};
  parsed.error.issues.forEach((issue) => {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in fieldErrors)) fieldErrors[field] = issue.message;
  });
  throw new DemoServerError("validation", "Les données saisies sont invalides.", fieldErrors);
}

function settle<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

function uniqueId(base: string, existing: readonly string[]): string {
  let candidate = base;
  let index = 2;
  while (existing.includes(candidate)) {
    candidate = `${base}-${String(index)}`;
    index += 1;
  }
  return candidate;
}

function newEvent(intervention: Intervention, title: string, detail: string | null, tone: InterventionEvent["tone"]): InterventionEvent {
  return { id: `${intervention.id}-${String(intervention.events.length + 1)}`, title, at: DEMO_NOW, detail, tone };
}

function toDevisView(raw: RawDevis, interventions: readonly Intervention[]): Devis {
  const intervention = interventions.find((item) => item.id === raw.interventionId);
  const mandant = intervention ? mandantById(intervention.mandantId) : undefined;
  const lines = raw.lines.map((line) => ({ ...line, totalMinor: line.quantity * line.unitMinor }));
  const totalMinor = sum(lines.map((line) => line.totalMinor));
  const { ht, vat } = splitVat(totalMinor, raw.vatBasisPoints);
  return {
    id: raw.id,
    interventionId: raw.interventionId,
    title: raw.title,
    contractor: raw.contractor,
    issuedOn: raw.issuedOn,
    state: raw.state,
    lines,
    vatBasisPoints: raw.vatBasisPoints,
    htMinor: ht,
    vatMinor: vat,
    totalMinor,
    ceilingMinor: WORKS_CEILING_MINOR,
    excessMinor: Math.max(0, totalMinor - WORKS_CEILING_MINOR),
    mandantId: intervention?.mandantId ?? "",
    mandateRef: mandant?.mandateRef ?? "",
    imputation: "Charges du propriétaire",
    deductedFrom: "Reversement du 05/12/2026",
    responseWithinHours: raw.responseWithinHours,
    message: raw.message,
    submittedOn: raw.submittedOn,
  };
}

export function createInterventionsDemo(): InterventionsSource {
  const interventions = createStore(seedInterventions());
  const devis = createStore(seedDevis());

  const find = (id: string): Intervention => {
    const found = interventions.get().find((item) => item.id === id);
    if (!found) throw new DemoServerError("not_found", "Intervention introuvable.");
    return found;
  };

  const replace = (id: string, change: (current: Intervention) => Intervention) => {
    interventions.update((items) => items.map((item) => (item.id === id ? change(item) : item)));
  };

  return {
    list: () => Promise.resolve(interventions.get()),
    get: (id) => Promise.resolve(interventions.get().find((item) => item.id === id) ?? null),
    listDevis: () => Promise.resolve(devis.get().map((raw) => toDevisView(raw, interventions.get()))),
    create: (input) =>
      settle(() => {
        const data = validate(createInterventionSchema, input);
        const lot = lotById(data.lotId);
        if (!lot) throw new DemoServerError("validation", "Bien inconnu.", { lotId: "Ce bien n'existe pas." });
        const contractor = contractorByName(data.contractor);
        const id = uniqueId(
          slugify(data.subject),
          interventions.get().map((item) => item.id),
        );
        const approvalRequired = data.estimatedMinor !== null && data.estimatedMinor > WORKS_CEILING_MINOR;
        const events: InterventionEvent[] = [
          { id: `${id}-1`, title: "Intervention ouverte", at: DEMO_NOW, detail: `créée par ${CURRENT_USER.name}`, tone: "default" },
        ];
        if (approvalRequired && data.estimatedMinor !== null) {
          events.unshift({
            id: `${id}-2`,
            title: "Accord du mandant demandé",
            at: DEMO_NOW,
            detail: `montant estimé ${formatMoney(data.estimatedMinor)}, au-delà du plafond de ${formatMoney(WORKS_CEILING_MINOR)}`,
            tone: "warning",
          });
        }
        const created: Intervention = {
          id,
          subject: data.subject,
          propertyLabel: lot.label,
          commonParts: false,
          lotId: lot.id,
          mandantId: lot.mandantId,
          address: lot.address,
          tenantId: lot.tenantId,
          contractor: data.contractor,
          contractorContact: contractor?.contact ?? "",
          contractorPhone: contractor?.phone ?? "",
          passage: null,
          dueOn: data.dueOn === "" ? null : data.dueOn,
          priority: data.priority,
          priorityNote: null,
          status: "ouverte",
          description: data.description,
          reportedOn: DEMO_TODAY,
          reportedBy: CURRENT_USER.name,
          completedOn: null,
          estimatedMinor: data.estimatedMinor,
          ceilingMinor: WORKS_CEILING_MINOR,
          approvalRequired,
          notifyTenant: data.notifyTenant,
          notifyMandant: data.notifyMandant,
          photos: data.photos,
          devisId: null,
          events,
        };
        interventions.update((items) => [created, ...items]);
        return { id };
      }),
    changeStatus: (input) =>
      settle(() => {
        const data = validate(statusChangeSchema, input);
        const current = find(data.id);
        if (!TRANSITIONS[current.status].includes(data.status)) {
          throw new DemoServerError("transition", "Ce changement d'état n'est pas possible.");
        }
        const meta = TRANSITION_EVENTS[data.status];
        replace(data.id, (item) => ({
          ...item,
          status: data.status,
          completedOn: data.status === "terminee" ? DEMO_TODAY : data.status === "ouverte" ? null : item.completedOn,
          events: [newEvent(item, meta.title, null, meta.tone), ...item.events],
        }));
      }),
    setPriority: (input) =>
      settle(() => {
        const data = validate(priorityChangeSchema, input);
        const current = find(data.id);
        if (current.priority === data.priority) return;
        replace(data.id, (item) => ({
          ...item,
          priority: data.priority,
          priorityNote: null,
          events: [newEvent(item, `Priorité modifiée : ${PRIORITY_LABELS[data.priority]}`, null, "default"), ...item.events],
        }));
      }),
    submitDevis: (input) =>
      settle(() => {
        const data = validate(submitDevisSchema, input);
        const raw = devis.get().find((item) => item.id === data.devisId);
        if (!raw) throw new DemoServerError("not_found", "Devis introuvable.");
        if (raw.state === "soumis") throw new DemoServerError("already_submitted", "Ce devis a déjà été soumis au mandant.");
        const view = toDevisView(raw, interventions.get());
        const mandant = mandantById(view.mandantId);
        devis.update((items) => items.map((item) => (item.id === raw.id ? { ...item, state: "soumis", message: data.message, submittedOn: DEMO_TODAY } : item)));
        replace(raw.interventionId, (item) => ({
          ...item,
          status: item.status === "devis_a_soumettre" ? "devis_soumis" : item.status,
          events: [
            newEvent(item, `Devis soumis au mandant, ${formatMoney(view.totalMinor)} TTC`, `${mandant?.name ?? "Mandant"}, réponse sous ${String(view.responseWithinHours)} h`, "default"),
            ...item.events,
          ],
        }));
      }),
  };
}

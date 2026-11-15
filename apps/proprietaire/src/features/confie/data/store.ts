import { ZodError } from "zod";
import { formatDate } from "./dates";
import { deriveNotifications } from "./derive";
import {
  documentInputSchema,
  earliestEndDate,
  ibanInputSchema,
  mandateEndSchema,
  preferencesInputSchema,
  profileInputSchema,
  quoteDecisionSchema,
} from "./inputs";
import type { ConfieData, Intervention } from "./schemas";

export class ConfieError extends Error {
  override readonly name = "ConfieError";
}

function parseInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) throw new ConfieError(error.issues[0]?.message ?? "Saisie invalide.");
    throw error;
  }
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ConfieStore {
  snapshot: () => ConfieData;
  decideQuote: (input: unknown) => void;
  requestMandateEnd: (input: unknown) => void;
  cancelMandateEnd: () => void;
  updateProfile: (input: unknown) => void;
  requestIbanChange: (input: unknown) => void;
  addDocument: (input: unknown) => void;
  savePreferences: (input: unknown) => void;
  markReportViewed: (reportId: string) => void;
  markAllNotificationsRead: () => void;
}

export function createConfieStore(initial: ConfieData): ConfieStore {
  const state = structuredClone(initial);

  const findIntervention = (id: string): Intervention => {
    const found = state.interventions.find((item) => item.id === id);
    if (!found) throw new ConfieError("Intervention introuvable.");
    return found;
  };

  return {
    snapshot: () => structuredClone(state),

    decideQuote(input) {
      const decision = parseInput(() => quoteDecisionSchema.parse(input));
      const intervention = findIntervention(decision.interventionId);
      const quote = intervention.quote;
      if (intervention.status !== "quote_pending" || !quote) throw new ConfieError("Ce devis n'attend plus de décision.");
      const date = formatDate(state.today);
      const note = decision.comment ? ` · ${decision.comment}` : "";
      const entryId = `decision-${String(intervention.timeline.length)}`;
      if (decision.decision === "accept") {
        intervention.status = "quote_accepted";
        intervention.timeline.push({
          id: entryId,
          title: "Devis accepté par vous",
          detail: `${date} · intervention planifiée le ${formatDate(quote.proposedOn)}${note}`,
          tone: "success",
        });
      } else if (decision.decision === "refuse") {
        intervention.status = "quote_refused";
        intervention.timeline.push({
          id: entryId,
          title: "Devis refusé par vous",
          detail: `${date} · motif : ${decision.comment}`,
          tone: "danger",
        });
      } else {
        intervention.timeline.push({
          id: entryId,
          title: "Précision demandée à l'agence",
          detail: `${date}${note}`,
          tone: "default",
        });
      }
      intervention.decision = { kind: decision.decision, comment: decision.comment, decidedOn: state.today };
    },

    requestMandateEnd(input) {
      const minDate = earliestEndDate(state.today, state.mandate.noticeMonths);
      const request = parseInput(() => mandateEndSchema(minDate).parse(input));
      if (state.mandate.endRequest) throw new ConfieError("Une demande de fin est déjà en cours.");
      const early = request.kind === "early";
      state.mandate.endRequest = {
        kind: request.kind,
        desiredOn: early ? request.desiredOn : null,
        reason: early && request.reason !== "" ? request.reason : null,
        details: request.details,
        requestedOn: state.today,
      };
    },

    cancelMandateEnd() {
      if (!state.mandate.endRequest) throw new ConfieError("Aucune demande de fin en cours.");
      state.mandate.endRequest = null;
    },

    updateProfile(input) {
      const values = parseInput(() => profileInputSchema.parse(input));
      state.profile = { ...state.profile, ...values };
    },

    requestIbanChange(input) {
      const { iban } = parseInput(() => ibanInputSchema.parse(input));
      state.profile.pendingIbanChange = {
        ibanLast4: iban.replace(/\s+/g, "").toUpperCase().slice(-4),
        requestedOn: state.today,
      };
    },

    addDocument(input) {
      const values = parseInput(() => documentInputSchema.parse(input));
      if (values.lotId !== "" && !state.lots.some((lot) => lot.id === values.lotId)) throw new ConfieError("Lot inconnu.");
      const base = `depose-${slugify(values.title) || "document"}`;
      const taken = new Set(state.documents.map((document) => document.id));
      let id = base;
      for (let suffix = 2; taken.has(id); suffix += 1) id = `${base}-${String(suffix)}`;
      state.documents.unshift({
        id,
        title: values.title,
        detail: `${values.fileType === "application/pdf" ? "PDF" : "Image"} · déposé par vous`,
        category: values.category,
        date: state.today,
        sizeKo: values.sizeKo,
        lotIds: values.lotId === "" ? [] : [values.lotId],
      });
    },

    savePreferences(input) {
      const updates = parseInput(() => preferencesInputSchema.parse(input));
      for (const update of updates) {
        if (!state.preferences.some((preference) => preference.id === update.id)) throw new ConfieError("Préférence inconnue.");
      }
      state.preferences = state.preferences.map((preference) => {
        const update = updates.find((item) => item.id === preference.id);
        return update ? { ...preference, email: update.email, push: update.push } : preference;
      });
    },

    markReportViewed(reportId) {
      const report = state.reports.find((item) => item.id === reportId);
      if (!report) throw new ConfieError("Compte rendu introuvable.");
      if (report.status === "new") report.status = "viewed";
    },

    markAllNotificationsRead() {
      state.readNotificationIds = deriveNotifications(state).map((item) => item.id);
    },
  };
}

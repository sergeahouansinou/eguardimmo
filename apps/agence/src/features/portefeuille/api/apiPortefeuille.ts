import { addDays, addMonths, parseDay } from "@/lib/dates";
import { invalid } from "./apiErrors";
import { toTermDefaults } from "./apiDefaults";
import { toMandatDocument } from "./apiDocuments";
import { toEndRequest, toMandant, toMandat } from "./apiMapping";
import type { MandateTermsInput } from "./apiPayloads";
import type { ApiMandateDetail } from "./apiSchemas";
import type { MandatesSource } from "./mandatesSource";
import { guarded, unavailableAction } from "./portefeuilleErrors";
import { portefeuilleSchema } from "../schemas";
import type { Mandat, PortefeuilleData, UnavailableKey } from "../schemas";
import type { MandatDocumentOperations, TermDefaultsOperations } from "./operationTypes";
import type { AvenantResult, MandatFormOptions, MandatOperations, NewAvenant, NewMandat, PortefeuilleSource } from "../source";
import { PortefeuilleError } from "../source";
import { todayOf } from "./today";

export const UNAVAILABLE_IN_API: readonly UnavailableKey[] = ["baux", "reversements", "documents", "historique", "coordonnees", "garantie"];

export interface ApiPortefeuilleOptions {
  mandates: MandatesSource;
  agencyName: string;
  canWrite: boolean;
  canEditDefaults?: boolean;
  now?: () => Date;
}

interface Known {
  version: number;
  renewalMonths?: number;
}

export const SIGNED_AVENANT_REQUIRED = "Joignez l’avenant signé par le mandant : une modification des conditions n’est enregistrée qu’avec la pièce signée.";
export const DEFAULTS_STALE_MESSAGE = "Ces conditions par défaut ont été modifiées par quelqu’un d’autre. Rechargez-les pour voir la dernière version, puis refaites votre changement.";
export const AMEND_ACTIVE_BY_AVENANT = "Sur un mandat activé, les conditions se modifient par un avenant signé : utilisez « Ajouter un avenant ».";

const WHOLE_MONTHS = "La prolongation se compte en mois entiers : choisissez une échéance qui tombe le même jour du mois que l’échéance actuelle.";

export function monthsToExtend(currentEndIso: string, nextEndIso: string): number {
  const from = parseDay(addDays(currentEndIso, 1));
  const to = parseDay(addDays(nextEndIso, 1));
  const months = (to.year - from.year) * 12 + (to.month - from.month);
  if (months < 1 || months > 120 || addMonths(addDays(currentEndIso, 1), months) !== addDays(nextEndIso, 1)) throw invalid(WHOLE_MONTHS, "end_date");
  return months;
}

export function createApiPortefeuilleSource({ mandates, agencyName, canWrite, canEditDefaults = false, now = () => new Date() }: ApiPortefeuilleOptions): PortefeuilleSource {
  const known = new Map<string, Known>();
  const today = (): string => todayOf(now());

  const remember = (detail: ApiMandateDetail): ApiMandateDetail => {
    known.set(detail.id, { version: detail.lock_version, renewalMonths: detail.renewal_months });
    return detail;
  };

  const finish = (detail: ApiMandateDetail): Mandat => toMandat(remember(detail), today());

  const detailOf = async (id: string): Promise<ApiMandateDetail> => remember(await mandates.get(id));

  const versionOf = async (id: string): Promise<number> => known.get(id)?.version ?? (await detailOf(id)).lock_version;

  const monthsOf = async (id: string): Promise<number> => known.get(id)?.renewalMonths ?? (await detailOf(id)).renewal_months;

  const load = async (): Promise<PortefeuilleData> =>
    guarded("other", async () => {
      const [running, archived, rows] = await Promise.all([mandates.listAll(), mandates.listAll({ archived: true }), mandates.mandants()]);
      const all = [...running, ...archived];
      for (const mandate of running) known.set(mandate.id, { ...known.get(mandate.id), version: mandate.lock_version });
      for (const mandate of archived) known.set(mandate.id, { ...known.get(mandate.id), version: mandate.lock_version });
      const kinds = new Map(all.map((mandate) => [mandate.mandant.id, mandate.mandant.kind] as const));
      return portefeuilleSchema.parse({
        origin: "api",
        unavailable: UNAVAILABLE_IN_API,
        agencyName,
        todayIso: today(),
        mandants: rows.map((row) => toMandant(row, kinds.get(row.party_id))),
        mandats: all.map((mandate) => toMandat(mandate, today())),
        biens: [],
        locataires: [],
        baux: [],
        events: [],
        interventions: [],
        messages: [],
        compliance: [],
        avenants: [],
        invitations: [],
        avis: [],
      });
    });

  const createMandat = async (input: NewMandat): Promise<Mandat> => {
    const api = input.api;
    if (api === undefined) throw new PortefeuilleError("Choisissez les lots du mandat parmi vos lots existants.", "lots", "invalid");
    const terms: MandateTermsInput = {
      feeKind: api.feeKind,
      ...(api.feeKind === "percentage" ? { feeBasisPoints: input.feeBasisPoints } : { feeFlatAmountMinor: api.flatFeeMinor ?? 0 }),
      payoutDay: input.payoutDay,
      worksLimitMinor: input.worksLimitMinor,
      feeBase: api.feeBase,
      feeMinimumMinor: api.feeMinimumMinor,
      feeTaxMode: api.feeTaxMode,
      ...(api.lettingFeeBasisPoints === undefined ? {} : { lettingFeeBasisPoints: api.lettingFeeBasisPoints }),
      ...(api.worksFeeBasisPoints === undefined ? {} : { worksFeeBasisPoints: api.worksFeeBasisPoints }),
    };
    const draft = await guarded("create", async () =>
      remember(
        await mandates.createDraft({
          mandantPartyId: input.mandantId,
          mandateTypeTermId: api.typeId,
          startsOn: input.startIso,
          endDate: input.endIso,
          tacitRenewal: input.renewal === "tacite",
          currency: api.currency,
          terms,
          units: api.unitIds.map((unitId) => ({ unitId })),
        }),
      ),
    );
    if (api.signedOnIso === undefined) return toMandat(draft, today());
    try {
      return await guarded("create", async () => finish(await mandates.activate(draft.id, draft.lock_version, api.signedOnIso ?? "")));
    } catch (error) {
      if (error instanceof PortefeuilleError) {
        throw new PortefeuilleError(`Le brouillon ${draft.reference} est enregistré, mais l’activation a échoué : ${error.message}`, error.field, error.kind);
      }
      throw error;
    }
  };

  const createAvenant = async (input: NewAvenant): Promise<AvenantResult> =>
    guarded("amend", async () => {
      const id = input.mandatId;
      const version = await versionOf(id);
      const applied = input.effectIso <= today();
      if (input.kind === "duree") {
        if (input.effectIso !== today()) throw invalid("Une prolongation s’applique immédiatement : la date d’effet est aujourd’hui.", "effective_on");
        const current = await detailOf(id);
        const months = monthsToExtend(current.end_date, input.endIso ?? current.end_date);
        const renewed = remember(await mandates.renew(id, version, months));
        return { mandatId: renewed.id, applied: true, effectIso: input.effectIso };
      }
      if (input.signedFileId === undefined) throw invalid(SIGNED_AVENANT_REQUIRED, "signed_file_id");
      const amended = remember(
        await mandates.amendTerms(id, version, {
          effectiveOn: input.effectIso,
          signedFileId: input.signedFileId,
          ...(input.kind === "honoraires"
            ? {
                feeKind: "percentage" as const,
                feeBasisPoints: input.feeBasisPoints,
                feeBase: input.feeBase,
                feeMinimumMinor: input.feeMinimumMinor,
                feeTaxMode: input.feeTaxMode,
                lettingFeeBasisPoints: input.lettingFeeBasisPoints,
                worksFeeBasisPoints: input.worksFeeBasisPoints,
              }
            : {}),
          ...(input.kind === "reversement" ? { payoutDay: input.payoutDay } : {}),
          ...(input.kind === "travaux" ? { worksLimitMinor: input.worksLimitMinor } : {}),
        }),
      );
      return { mandatId: amended.id, applied, effectIso: input.effectIso };
    });

  const patch: PortefeuilleSource["patch"] = async (kind, id, changes) => {
    if (kind !== "mandat") throw unavailableAction("Modifier cette fiche");
    await guarded("amend", async () => {
      const current = await detailOf(id);
      const terms = current.terms;
      if (terms === null) throw invalid("Ce mandat n’a pas de conditions en vigueur.");
      const payoutDay = typeof changes.payoutDay === "number" ? changes.payoutDay : undefined;
      const worksLimitMinor = typeof changes.worksLimitMinor === "number" ? changes.worksLimitMinor : undefined;
      if (current.status === "draft") {
        remember(
          await mandates.update(id, await versionOf(id), {
            terms: {
              feeKind: terms.fee_kind,
              ...(terms.fee_kind === "percentage" ? { feeBasisPoints: terms.fee_basis_points ?? 0 } : { feeFlatAmountMinor: terms.fee_flat_amount?.amount ?? 0 }),
              payoutDay: payoutDay ?? terms.payout_day,
              worksLimitMinor: worksLimitMinor ?? terms.works_limit_amount.amount,
              ...(terms.fee_base === null ? {} : { feeBase: terms.fee_base }),
              feeMinimumMinor: terms.fee_minimum_amount.amount,
              feeTaxMode: terms.fee_tax_mode,
              ...(terms.letting_fee_basis_points === null ? {} : { lettingFeeBasisPoints: terms.letting_fee_basis_points }),
              ...(terms.works_fee_basis_points === null ? {} : { worksFeeBasisPoints: terms.works_fee_basis_points }),
            },
          }),
        );
        return;
      }
      throw invalid(AMEND_ACTIVE_BY_AVENANT);
    });
  };

  const operations: MandatOperations = {
    activate: (id, signedOnIso) => guarded("other", async () => void remember(await mandates.activate(id, await versionOf(id), signedOnIso))),
    suspend: (id) => guarded("other", async () => void remember(await mandates.suspend(id, await versionOf(id)))),
    resume: (id) => guarded("other", async () => void remember(await mandates.resume(id, await versionOf(id)))),
    archive: (id) => guarded("other", async () => void remember(await mandates.archive(id))),
    restore: (id) => guarded("other", async () => void remember(await mandates.restore(id))),
    addUnit: (id, unitId, fromIso) =>
      guarded("other", async () => void remember(await mandates.addUnit(id, await versionOf(id), { unitId, ...(fromIso === undefined ? {} : { validFrom: fromIso }) }))),
    removeUnit: (id, mandatUnitId) => guarded("other", async () => void remember(await mandates.removeUnit(id, await versionOf(id), mandatUnitId))),
    endUnit: (id, mandatUnitId, endIso) => guarded("other", async () => void remember(await mandates.endUnit(id, await versionOf(id), mandatUnitId, endIso))),
  };

  const documents: MandatDocumentOperations = {
    list: (id) => guarded("document", async () => (await mandates.documents(id)).map(toMandatDocument)),
    upload: (id, file) => guarded("document", () => mandates.uploadFile(id, file)),
    share: (id, storedFileId, kind) => guarded("document", async () => toMandatDocument(await mandates.shareDocument(id, storedFileId, kind))),
    unshare: (id, documentId) => guarded("document", async () => toMandatDocument(await mandates.unshareDocument(id, documentId))),
  };

  const termDefaults: TermDefaultsOperations = {
    canSave: canEditDefaults,
    load: () => guarded("defaults", async () => {
      const loaded = await mandates.termDefaults();
      return loaded === null ? null : toTermDefaults(loaded);
    }),
    save: async (lockVersion, input) => {
      try {
        return await guarded("defaults", async () => toTermDefaults(await mandates.saveTermDefaults(lockVersion, input)));
      } catch (error) {
        if (error instanceof PortefeuilleError && error.kind === "stale_version") throw new PortefeuilleError(DEFAULTS_STALE_MESSAGE, error.field, error.kind);
        throw error;
      }
    },
  };

  const formOptions = (): Promise<MandatFormOptions> =>
    guarded("other", async () => {
      const [parties, units, types] = await Promise.all([mandates.parties(), mandates.units(), mandates.mandateTypes()]);
      return {
        mandants: parties.map((party) => ({ id: party.id, name: party.name, legal: party.kind === "person" ? "Particulier" : "Personne morale" })),
        units,
        types,
      };
    });

  return {
    canWrite,
    operations,
    documents,
    termDefaults,
    load,
    mandatDetail: (id) => guarded("other", async () => toMandat(await detailOf(id), today())),
    mandatEndRequest: async (id) => {
      const request = await mandates.endRequest(id);
      return request === null ? null : toEndRequest(request);
    },
    dismissEndRequest: (id, note) => guarded("other", async () => toEndRequest(await mandates.dismissEndRequest(id, note))),
    formOptions,
    createMandat,
    createAvenant,
    patch,
    renewMandat: (id) =>
      guarded("renew", async () => {
        const months = await monthsOf(id);
        return finish(await mandates.renew(id, await versionOf(id), months));
      }),
    terminateMandat: (id, termination) =>
      guarded("terminate", async () =>
        finish(
          await mandates.terminate(id, await versionOf(id), {
            noticeGivenOn: termination.noticeIso ?? today(),
            effectiveOn: termination.effectIso,
            reason: termination.reason ?? "Résiliation",
            amicable: termination.amicable === true,
            note: termination.note,
          }),
        ),
      ),
    createMandant: () => Promise.reject(unavailableAction("Créer un mandant")),
    createBail: () => Promise.reject(unavailableAction("Créer un bail depuis les mandats")),
    createBien: () => Promise.reject(unavailableAction("Créer un lot depuis les mandats")),
    createInvitation: () => Promise.reject(unavailableAction("Inviter un locataire")),
    resendInvitation: () => Promise.reject(unavailableAction("Renvoyer une invitation")),
    cancelInvitation: () => Promise.reject(unavailableAction("Annuler une invitation")),
    sendAvis: () => Promise.reject(unavailableAction("Envoyer un avis d’échéance")),
  };
}

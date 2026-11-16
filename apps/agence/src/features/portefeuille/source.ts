"use client";

import { createContext, use } from "react";
import { addDays, addMonths, formatDay, yearMonth } from "@/lib/dates";
import { dataSource } from "@/lib/env";
import { formatEuros, formatRate } from "@/lib/money";
import { createDemoData } from "./demo";
import { INVITATION_BASE_URL, avisId } from "./demoExtra";
import { isOperational, mandatState } from "./selectors";
import { slugify } from "./slug";
import {
  avenantSchema,
  avisSchema,
  bailSchema,
  bienSchema,
  invitationSchema,
  locataireSchema,
  mandantSchema,
  mandatSchema,
  portefeuilleSchema,
  terminationSchema,
} from "./schemas";
import type { Avenant, AvenantKind, Bail, Bien, Invitation, Mandant, Mandat, PaymentMode, PortefeuilleData, Termination } from "./schemas";

export class PortefeuilleError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "PortefeuilleError";
  }
}

export type NewMandant = Omit<Mandant, "id" | "sinceIso">;

export interface NewLot {
  name: string;
  kind: string;
  surfaceM2: number;
  street: string;
  postalCode: string;
  city: string;
}

export interface NewMandat {
  mandantId: string;
  lots: NewLot[];
  feeBasisPoints: number;
  payoutDay: number;
  worksLimitMinor: number;
  renewal: "aucune" | "tacite";
  startIso: string;
  endIso: string;
  signed: boolean;
}

export interface NewBail {
  bienId: string;
  locataireId: string;
  startIso: string;
  endIso: string;
  furnished: boolean;
  rentMinor: number;
  chargesMinor: number;
  depositMinor: number;
  dueDay: number;
  paymentMode: PaymentMode;
  note?: string;
  draft: boolean;
}

export interface NewBien {
  mandatId: string;
  name: string;
  kind: string;
  surfaceM2: number;
  street: string;
  postalCode: string;
  city: string;
  floor: string;
  dpe: string;
  heating: string;
  syndic: string;
  propertyTax: string;
  targetRentMinor: number;
  targetChargesMinor: number;
}

export interface NewAvenant {
  mandatId: string;
  kind: AvenantKind;
  effectIso: string;
  feeBasisPoints?: number;
  endIso?: string;
  payoutDay?: number;
  worksLimitMinor?: number;
  note: string;
}

export interface NewInvitation {
  email: string;
  bailId: string;
  message: string;
}

export interface SendAvisInput {
  bailIds: readonly string[];
  month: string;
  resend: boolean;
}

export interface SendAvisResult {
  sent: number;
  skipped: number;
}

export const INVITATION_VALIDITY_DAYS = 14;
export const AVIS_MONTHS_BEFORE = 1;
export const AVIS_MONTHS_AFTER = 3;

export type PatchKind = "mandant" | "mandat" | "bien" | "locataire" | "bail";

export interface PortefeuilleSource {
  load: () => Promise<unknown>;
  createMandant: (input: NewMandant) => Promise<Mandant>;
  createMandat: (input: NewMandat) => Promise<Mandat>;
  renewMandat: (id: string) => Promise<Mandat>;
  terminateMandat: (id: string, termination: Termination) => Promise<Mandat>;
  createBail: (input: NewBail) => Promise<Bail>;
  createBien: (input: NewBien) => Promise<Bien>;
  createAvenant: (input: NewAvenant) => Promise<Avenant>;
  createInvitation: (input: NewInvitation) => Promise<Invitation>;
  resendInvitation: (id: string) => Promise<Invitation>;
  cancelInvitation: (id: string) => Promise<Invitation>;
  sendAvis: (input: SendAvisInput) => Promise<SendAvisResult>;
  patch: (kind: PatchKind, id: string, patch: Record<string, unknown>) => Promise<void>;
}

const RENEWAL_MONTHS = 36;

function uniqueId(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let suffix = 2;
  while (taken.includes(`${base}-${String(suffix)}`)) suffix += 1;
  return `${base}-${String(suffix)}`;
}

function nextNumber(prefix: string, year: string, existing: readonly string[], width: number): string {
  const highest = existing.reduce((max, number) => Math.max(max, Number(number.split("-")[2] ?? 0)), 0);
  return `${prefix}-${year}-${String(highest + 1).padStart(width, "0")}`;
}

function invitationToken(bailId: string, sequence: number): string {
  let hash = 7;
  for (const char of `${bailId}:${String(sequence)}`) hash = (hash * 31 + char.charCodeAt(0)) % 2_176_782_336;
  return `${bailId}-${hash.toString(36).padStart(6, "0")}`;
}

function describeAvenant(mandat: Mandat, input: NewAvenant): { previous: string; next: string } {
  if (input.kind === "honoraires") return { previous: formatRate(mandat.feeBasisPoints), next: formatRate(input.feeBasisPoints ?? mandat.feeBasisPoints) };
  if (input.kind === "duree") return { previous: formatDay(mandat.endIso), next: formatDay(input.endIso ?? mandat.endIso) };
  if (input.kind === "reversement") return { previous: `Le ${String(mandat.payoutDay)}`, next: `Le ${String(input.payoutDay ?? mandat.payoutDay)}` };
  return { previous: formatEuros(mandat.worksLimitMinor), next: formatEuros(input.worksLimitMinor ?? mandat.worksLimitMinor) };
}

const AVENANT_TITLES: Record<AvenantKind, string> = {
  honoraires: "Honoraires",
  duree: "Échéance",
  reversement: "Jour de reversement",
  travaux: "Plafond des travaux sans accord",
};

const patchSchemas = {
  mandant: mandantSchema.omit({ id: true }).partial().strict(),
  mandat: mandatSchema.omit({ id: true }).partial().strict(),
  bien: bienSchema.omit({ id: true }).partial().strict(),
  locataire: locataireSchema.omit({ id: true }).partial().strict(),
  bail: bailSchema.omit({ id: true }).partial().strict(),
} as const;

const collections = {
  mandant: "mandants",
  mandat: "mandats",
  bien: "biens",
  locataire: "locataires",
  bail: "baux",
} as const;

export function createDemoSource(initial: PortefeuilleData = createDemoData()): PortefeuilleSource {
  const data: PortefeuilleData = structuredClone(initial);

  return {
    load: () => Promise.resolve(structuredClone(data)),

    createMandant: (input) => {
      const name = input.name.trim();
      const id = uniqueId(slugify(name), data.mandants.map((mandant) => mandant.id));
      const mandant = mandantSchema.parse({ ...input, name, id, sinceIso: data.todayIso });
      data.mandants.push(mandant);
      return Promise.resolve(structuredClone(mandant));
    },

    createMandat: (input) => {
      const mandant = data.mandants.find((item) => item.id === input.mandantId);
      if (!mandant) return Promise.reject(new PortefeuilleError("Ce mandant n'existe pas.", "mandantId"));
      const names = input.lots.map((lot) => slugify(lot.name));
      const takenIds = data.biens.map((bien) => bien.id);
      const duplicate = names.find((name, index) => takenIds.includes(name) || names.indexOf(name) !== index);
      if (duplicate) return Promise.reject(new PortefeuilleError(`Un lot nommé « ${duplicate} » existe déjà : choisissez un autre nom.`, "lots"));
      const number = nextNumber("M", yearMonth(data.todayIso).slice(0, 4), data.mandats.map((mandat) => mandat.number), 4);
      const mandat = mandatSchema.parse({
        id: slugify(number),
        number,
        mandantId: input.mandantId,
        status: input.signed ? "actif" : "brouillon",
        startIso: input.startIso,
        endIso: input.endIso,
        feeBasisPoints: input.feeBasisPoints,
        payoutDay: input.payoutDay,
        worksLimitMinor: input.worksLimitMinor,
        renewal: input.renewal,
        guaranteeUntilIso: "2027-12-31",
        signed: input.signed,
      });
      const biens = input.lots.map((lot) =>
        bienSchema.parse({
          id: slugify(lot.name),
          name: lot.name.trim(),
          kind: lot.kind.trim(),
          surfaceM2: lot.surfaceM2,
          street: lot.street.trim(),
          postalCode: lot.postalCode,
          city: lot.city.trim(),
          mandatId: mandat.id,
          floor: "Non renseigné",
          dpe: "Non renseigné",
          heating: "Non renseigné",
          syndic: "Non renseigné",
          pnoUntilIso: input.endIso,
          propertyTax: "Non renseigné",
        }),
      );
      data.mandats.push(mandat);
      data.biens.push(...biens);
      return Promise.resolve(structuredClone(mandat));
    },

    renewMandat: (id) => {
      const mandat = data.mandats.find((item) => item.id === id);
      if (!mandat) return Promise.reject(new PortefeuilleError("Ce mandat n'existe pas."));
      if (mandat.status === "termine" || mandat.status === "brouillon") {
        return Promise.reject(new PortefeuilleError("Seul un mandat en cours peut être renouvelé."));
      }
      mandat.endIso = addMonths(mandat.endIso, RENEWAL_MONTHS);
      mandat.status = "actif";
      return Promise.resolve(structuredClone(mandat));
    },

    terminateMandat: (id, termination) => {
      const mandat = data.mandats.find((item) => item.id === id);
      if (!mandat) return Promise.reject(new PortefeuilleError("Ce mandat n'existe pas."));
      if (mandat.status === "termine" || mandat.termination) {
        return Promise.reject(new PortefeuilleError("Ce mandat est déjà résilié."));
      }
      mandat.termination = terminationSchema.parse(termination);
      return Promise.resolve(structuredClone(mandat));
    },

    createBail: (input) => {
      const bien = data.biens.find((item) => item.id === input.bienId);
      if (!bien) return Promise.reject(new PortefeuilleError("Ce lot n'existe pas.", "bienId"));
      if (!data.locataires.some((item) => item.id === input.locataireId)) {
        return Promise.reject(new PortefeuilleError("Ce locataire n'existe pas.", "locataireId"));
      }
      const conflict = data.baux.find(
        (bail) =>
          bail.bienId === input.bienId &&
          (bail.status === "en_cours" || bail.status === "a_venir") &&
          bail.endIso >= input.startIso &&
          bail.startIso <= input.endIso,
      );
      if (conflict) {
        return Promise.reject(new PortefeuilleError(`Le bail ${conflict.number} occupe déjà ce lot à cette période.`, "startIso"));
      }
      const number = nextNumber("B", data.todayIso.slice(0, 4), data.baux.map((bail) => bail.number), 3);
      const bail = bailSchema.parse({
        id: slugify(number),
        number,
        bienId: input.bienId,
        locataireId: input.locataireId,
        status: input.draft ? "brouillon" : input.startIso > data.todayIso ? "a_venir" : "en_cours",
        furnished: input.furnished,
        startIso: input.startIso,
        endIso: input.endIso,
        rentMinor: input.rentMinor,
        chargesMinor: input.chargesMinor,
        depositMinor: input.depositMinor,
        dueDay: input.dueDay,
        paymentMode: input.paymentMode,
        noticeGiven: false,
        ...(input.note ? { note: input.note } : {}),
      });
      data.baux.push(bail);
      return Promise.resolve(structuredClone(bail));
    },

    createBien: (input) => {
      const mandat = data.mandats.find((item) => item.id === input.mandatId);
      if (!mandat || !isOperational(mandatState(mandat, data.todayIso))) {
        return Promise.reject(new PortefeuilleError("Ce mandat n'est pas en cours : choisissez un autre mandat.", "mandatId"));
      }
      const name = input.name.trim();
      const id = slugify(name);
      if (id === "" || data.biens.some((bien) => bien.id === id)) {
        return Promise.reject(new PortefeuilleError(`Un lot nommé « ${name} » existe déjà : choisissez un autre nom.`, "name"));
      }
      const bien = bienSchema.parse({
        id,
        name,
        kind: input.kind.trim(),
        surfaceM2: input.surfaceM2,
        street: input.street.trim(),
        postalCode: input.postalCode,
        city: input.city.trim(),
        mandatId: mandat.id,
        floor: input.floor.trim() || "Non renseigné",
        dpe: input.dpe.trim() || "Non renseigné",
        heating: input.heating.trim() || "Non renseigné",
        syndic: input.syndic.trim() || "Non renseigné",
        pnoUntilIso: mandat.endIso,
        propertyTax: input.propertyTax.trim() || "Non renseigné",
        targetRentMinor: input.targetRentMinor,
        targetChargesMinor: input.targetChargesMinor,
      });
      data.biens.push(bien);
      data.events.push({
        id: `bien-${id}-ajout`,
        kind: "bien",
        subjectId: id,
        dateIso: data.todayIso,
        title: `Lot ajouté au mandat ${mandat.number}`,
        detail: `${bien.street}, ${bien.postalCode} ${bien.city}`,
        tone: "info",
      });
      return Promise.resolve(structuredClone(bien));
    },

    createAvenant: (input) => {
      const mandat = data.mandats.find((item) => item.id === input.mandatId);
      if (!mandat) return Promise.reject(new PortefeuilleError("Ce mandat n'existe pas.", "mandatId"));
      const state = mandatState(mandat, data.todayIso);
      if (!isOperational(state) || state === "resilie") {
        return Promise.reject(new PortefeuilleError("Ce mandat est terminé ou en cours de résiliation : il ne peut plus être modifié par avenant.", "mandatId"));
      }
      if (input.effectIso < data.todayIso) {
        return Promise.reject(new PortefeuilleError("La date d'effet ne peut pas être antérieure à aujourd'hui.", "effectIso"));
      }
      if (input.kind === "duree" && (!input.endIso || input.endIso <= mandat.endIso)) {
        return Promise.reject(new PortefeuilleError(`La nouvelle échéance doit suivre l'échéance actuelle du ${formatDay(mandat.endIso)}.`, "endIso"));
      }
      if (input.kind === "honoraires" && input.feeBasisPoints === undefined) {
        return Promise.reject(new PortefeuilleError("Indiquez le nouveau taux d'honoraires.", "feePercent"));
      }
      if (input.kind === "reversement" && input.payoutDay === undefined) {
        return Promise.reject(new PortefeuilleError("Indiquez le nouveau jour de reversement.", "payoutDay"));
      }
      if (input.kind === "travaux" && input.worksLimitMinor === undefined) {
        return Promise.reject(new PortefeuilleError("Indiquez le nouveau plafond de travaux.", "worksLimit"));
      }
      const number = nextNumber("AV", data.todayIso.slice(0, 4), data.avenants.map((avenant) => avenant.number), 4);
      const applied = input.effectIso <= data.todayIso;
      const { previous, next } = describeAvenant(mandat, input);
      const avenant = avenantSchema.parse({
        id: slugify(number),
        number,
        mandatId: mandat.id,
        kind: input.kind,
        effectIso: input.effectIso,
        createdIso: data.todayIso,
        applied,
        ...(input.feeBasisPoints !== undefined ? { feeBasisPoints: input.feeBasisPoints } : {}),
        ...(input.endIso !== undefined ? { endIso: input.endIso } : {}),
        ...(input.payoutDay !== undefined ? { payoutDay: input.payoutDay } : {}),
        ...(input.worksLimitMinor !== undefined ? { worksLimitMinor: input.worksLimitMinor } : {}),
        previous,
        next,
        note: input.note.trim(),
      });
      if (applied) {
        if (avenant.feeBasisPoints !== undefined) mandat.feeBasisPoints = avenant.feeBasisPoints;
        if (avenant.endIso !== undefined) {
          mandat.endIso = avenant.endIso;
          if (mandat.status === "a_renouveler") mandat.status = "actif";
        }
        if (avenant.payoutDay !== undefined) mandat.payoutDay = avenant.payoutDay;
        if (avenant.worksLimitMinor !== undefined) mandat.worksLimitMinor = avenant.worksLimitMinor;
      }
      data.avenants.push(avenant);
      data.events.push({
        id: `mandat-${mandat.id}-${avenant.id}`,
        kind: "mandat",
        subjectId: mandat.id,
        dateIso: data.todayIso,
        title: `Avenant ${number} ${applied ? "appliqué" : "programmé"}`,
        detail: `${AVENANT_TITLES[avenant.kind]} : ${previous} → ${next}, effet le ${formatDay(avenant.effectIso)}`,
        tone: "info",
      });
      return Promise.resolve(structuredClone(avenant));
    },

    createInvitation: (input) => {
      const bail = data.baux.find((item) => item.id === input.bailId);
      if (!bail || bail.status === "termine") return Promise.reject(new PortefeuilleError("Ce bail n'existe pas ou est terminé.", "bailId"));
      const tenant = data.locataires.find((item) => item.id === bail.locataireId);
      if (!tenant) return Promise.reject(new PortefeuilleError("Le locataire de ce bail est introuvable.", "bailId"));
      if (tenant.spaceActive) return Promise.reject(new PortefeuilleError(`${tenant.name} a déjà accès à son espace locataire.`, "bailId"));
      const email = input.email.trim().toLowerCase();
      const pending = data.invitations.find(
        (item) => item.bailId === bail.id && item.email === email && item.status === "envoyee" && item.expiresIso >= data.todayIso,
      );
      if (pending) {
        return Promise.reject(new PortefeuilleError(`Une invitation est déjà en cours pour ${email} sur le bail ${bail.number}. Renvoyez-la depuis le suivi.`, "email"));
      }
      const sequence = data.invitations.length + 1;
      const invitation = invitationSchema.parse({
        id: `inv-${String(sequence).padStart(4, "0")}`,
        email,
        name: tenant.name,
        bailId: bail.id,
        message: input.message.trim(),
        link: `${INVITATION_BASE_URL}/${invitationToken(tenant.id, sequence)}`,
        sentIso: data.todayIso,
        expiresIso: addDays(data.todayIso, INVITATION_VALIDITY_DAYS),
        status: "envoyee",
        reminders: 0,
      });
      data.invitations.push(invitation);
      return Promise.resolve(structuredClone(invitation));
    },

    resendInvitation: (id) => {
      const invitation = data.invitations.find((item) => item.id === id);
      if (!invitation) return Promise.reject(new PortefeuilleError("Cette invitation n'existe pas."));
      if (invitation.status === "acceptee") return Promise.reject(new PortefeuilleError("Cette invitation a déjà été acceptée."));
      invitation.status = "envoyee";
      invitation.sentIso = data.todayIso;
      invitation.expiresIso = addDays(data.todayIso, INVITATION_VALIDITY_DAYS);
      invitation.reminders += 1;
      return Promise.resolve(structuredClone(invitation));
    },

    cancelInvitation: (id) => {
      const invitation = data.invitations.find((item) => item.id === id);
      if (!invitation) return Promise.reject(new PortefeuilleError("Cette invitation n'existe pas."));
      if (invitation.status === "acceptee") return Promise.reject(new PortefeuilleError("Cette invitation a déjà été acceptée : elle ne peut plus être annulée."));
      invitation.status = "annulee";
      return Promise.resolve(structuredClone(invitation));
    },

    sendAvis: (input) => {
      const first = yearMonth(addMonths(data.todayIso, -AVIS_MONTHS_BEFORE));
      const last = yearMonth(addMonths(data.todayIso, AVIS_MONTHS_AFTER));
      if (!/^\d{4}-\d{2}$/.test(input.month) || input.month < first || input.month > last) {
        return Promise.reject(new PortefeuilleError("Ce mois n'est pas disponible pour un avis d'échéance.", "month"));
      }
      if (input.bailIds.length === 0) return Promise.reject(new PortefeuilleError("Sélectionnez au moins un bail.", "bailIds"));
      const unknown = input.bailIds.find((bailId) => !data.baux.some((bail) => bail.id === bailId && bail.status === "en_cours"));
      if (unknown) return Promise.reject(new PortefeuilleError(`Le bail « ${unknown} » n'est pas en cours : aucun avis ne peut être émis.`, "bailIds"));
      let sent = 0;
      let skipped = 0;
      for (const bailId of new Set(input.bailIds)) {
        const id = avisId(bailId, input.month);
        const existing = data.avis.find((item) => item.id === id);
        if (existing && !input.resend) {
          skipped += 1;
        } else if (existing) {
          existing.sentIso = data.todayIso;
          sent += 1;
        } else {
          data.avis.push(avisSchema.parse({ id, bailId, month: input.month, sentIso: data.todayIso }));
          sent += 1;
        }
      }
      return Promise.resolve({ sent, skipped });
    },

    patch: (kind, id, patch) => {
      const parsed = patchSchemas[kind].safeParse(patch);
      if (!parsed.success) {
        return Promise.reject(new PortefeuilleError(parsed.error.issues[0]?.message ?? "Modification invalide."));
      }
      const list: { id: string }[] = data[collections[kind]];
      const target = list.find((item) => item.id === id);
      if (!target) return Promise.reject(new PortefeuilleError("Cet élément n'existe pas."));
      Object.assign(target, parsed.data);
      return Promise.resolve();
    },
  };
}

export function parsePortefeuille(raw: unknown): PortefeuilleData {
  return portefeuilleSchema.parse(raw);
}

const SourceContext = createContext<PortefeuilleSource | null>(null);

export const PortefeuilleSourceProvider = SourceContext.Provider;

let fallback: PortefeuilleSource | undefined;

export function usePortefeuilleSource(): PortefeuilleSource {
  const provided = use(SourceContext);
  if (provided) return provided;
  if (dataSource === "api") throw new Error("Aucune source du portefeuille n’est montée en mode api : l’écran ne peut pas retomber sur les données de démonstration.");
  fallback ??= createDemoSource();
  return fallback;
}

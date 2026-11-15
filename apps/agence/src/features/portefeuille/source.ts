"use client";

import { createContext, use } from "react";
import { addMonths, yearMonth } from "@/lib/dates";
import { createDemoData } from "./demo";
import { slugify } from "./slug";
import { bailSchema, bienSchema, locataireSchema, mandantSchema, mandatSchema, portefeuilleSchema, terminationSchema } from "./schemas";
import type { Bail, Mandant, Mandat, PaymentMode, PortefeuilleData, Termination } from "./schemas";

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

export type PatchKind = "mandant" | "mandat" | "bien" | "locataire" | "bail";

export interface PortefeuilleSource {
  load: () => Promise<unknown>;
  createMandant: (input: NewMandant) => Promise<Mandant>;
  createMandat: (input: NewMandat) => Promise<Mandat>;
  renewMandat: (id: string) => Promise<Mandat>;
  terminateMandat: (id: string, termination: Termination) => Promise<Mandat>;
  createBail: (input: NewBail) => Promise<Bail>;
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
  fallback ??= createDemoSource();
  return fallback;
}

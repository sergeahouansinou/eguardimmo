import { addMonths, daysBetween, parseDay, toIso, yearMonth } from "@/lib/dates";
import { applyRate } from "@/lib/money";
import type { Bail, Bien, Locataire, Mandant, Mandat, MandatUnit, PaymentMode, PortefeuilleData, UnavailableKey } from "./schemas";

export type MandatState = "actif" | "a_renouveler" | "suspendu" | "resilie" | "termine" | "brouillon";

export function mandatState(mandat: Mandat, todayIso: string): MandatState {
  if (mandat.status === "brouillon") return "brouillon";
  if (mandat.status === "termine") return "termine";
  if (mandat.status === "suspendu") return "suspendu";
  if (mandat.termination) return mandat.termination.effectIso <= todayIso ? "termine" : "resilie";
  return mandat.status;
}

export const isOperational = (state: MandatState): boolean => state === "actif" || state === "a_renouveler" || state === "suspendu" || state === "resilie";

export type BailSituation = "a_jour" | "impaye" | "preavis";

export function calledMinor(bail: Bail): number {
  return bail.rentMinor + bail.chargesMinor;
}

export function collectedMinor(bail: Bail): number {
  return bail.overdueSinceIso ? 0 : calledMinor(bail);
}

export function balanceMinor(bail: Bail): number {
  return bail.overdueSinceIso ? -calledMinor(bail) : 0;
}

export function overdueDays(bail: Bail, todayIso: string): number {
  return bail.overdueSinceIso ? daysBetween(bail.overdueSinceIso, todayIso) : 0;
}

export function bailSituation(bail: Bail): BailSituation {
  if (bail.overdueSinceIso) return "impaye";
  return bail.noticeGiven ? "preavis" : "a_jour";
}

export function openUnits(mandat: Mandat): MandatUnit[] {
  return (mandat.units ?? []).filter((unit) => unit.endIso === null);
}

export interface Portefeuille {
  data: PortefeuilleData;
  isApi: boolean;
  isUnavailable: (key: UnavailableKey) => boolean;
  lotCount: (mandat: Mandat) => number;
  mandant: (id: string) => Mandant | undefined;
  mandat: (id: string) => Mandat | undefined;
  bien: (id: string) => Bien | undefined;
  locataire: (id: string) => Locataire | undefined;
  bail: (id: string) => Bail | undefined;
  currentBail: (bienId: string) => Bail | undefined;
  currentBailOf: (locataireId: string) => Bail | undefined;
  mandatsOf: (mandantId: string) => Mandat[];
  activeMandat: (mandantId: string) => Mandat | undefined;
  biensOfMandat: (mandatId: string) => Bien[];
  biensOfMandant: (mandantId: string) => Bien[];
  mandantOfBien: (bien: Bien) => Mandant | undefined;
}

export function indexPortefeuille(data: PortefeuilleData): Portefeuille {
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
  const mandants = byId(data.mandants);
  const mandats = byId(data.mandats);
  const biens = byId(data.biens);
  const locataires = byId(data.locataires);
  const baux = byId(data.baux);
  const currentBail = (bienId: string) => data.baux.find((bail) => bail.bienId === bienId && bail.status === "en_cours");
  const mandatsOf = (mandantId: string) => data.mandats.filter((mandat) => mandat.mandantId === mandantId);
  const activeMandat = (mandantId: string) =>
    mandatsOf(mandantId).find((mandat) => !mandat.archived && isOperational(mandatState(mandat, data.todayIso)));
  const biensOfMandat = (mandatId: string) => data.biens.filter((bien) => bien.mandatId === mandatId);
  const unavailable = new Set<UnavailableKey>(data.unavailable ?? []);
  return {
    data,
    isApi: data.origin === "api",
    isUnavailable: (key) => unavailable.has(key),
    lotCount: (mandat) => (mandat.units ? openUnits(mandat).length : biensOfMandat(mandat.id).length),
    mandant: (id) => mandants.get(id),
    mandat: (id) => mandats.get(id),
    bien: (id) => biens.get(id),
    locataire: (id) => locataires.get(id),
    bail: (id) => baux.get(id),
    currentBail,
    currentBailOf: (locataireId) => data.baux.find((bail) => bail.locataireId === locataireId && bail.status === "en_cours"),
    mandatsOf,
    activeMandat,
    biensOfMandat,
    biensOfMandant: (mandantId) => {
      const active = activeMandat(mandantId);
      return active ? biensOfMandat(active.id) : [];
    },
    mandantOfBien: (bien) => {
      const mandat = mandats.get(bien.mandatId);
      return mandat ? mandants.get(mandat.mandantId) : undefined;
    },
  };
}

export interface MandantFigures {
  lots: number;
  calledMinor: number;
  collectedMinor: number;
  feeMinor: number;
  payoutMinor: number;
}

export function mandantFigures(index: Portefeuille, mandantId: string): MandantFigures {
  const mandat = index.activeMandat(mandantId);
  const baux = index.biensOfMandant(mandantId).flatMap((bien) => index.currentBail(bien.id) ?? []);
  const called = baux.reduce((sum, bail) => sum + calledMinor(bail), 0);
  const collected = baux.reduce((sum, bail) => sum + collectedMinor(bail), 0);
  const fee = mandat ? applyRate(collected, mandat.feeBasisPoints) : 0;
  return { lots: baux.length, calledMinor: called, collectedMinor: collected, feeMinor: fee, payoutMinor: collected - fee };
}

export function nextPayoutIso(todayIso: string, payoutDay: number): string {
  const { year, month, day } = parseDay(todayIso);
  const sameMonth = toIso(year, month, payoutDay);
  return day < payoutDay ? sameMonth : addMonths(sameMonth, 1);
}

export type EcheanceState = "paye" | "impaye";

export interface Echeance {
  id: string;
  dueIso: string;
  calledMinor: number;
  collectedMinor: number;
  state: EcheanceState;
  paidIso?: string;
  mode: PaymentMode;
}

function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return hash;
}

export function buildSchedule(bail: Bail, todayIso: string): Echeance[] {
  const start = parseDay(bail.startIso);
  let index = start.day > bail.dueDay ? 1 : 0;
  const result: Echeance[] = [];
  for (;; index += 1) {
    const dueIso = addMonths(toIso(start.year, start.month, bail.dueDay), index);
    if (dueIso > todayIso || dueIso > bail.endIso) break;
    const ym = yearMonth(dueIso);
    const unpaid = bail.overdueSinceIso !== undefined && dueIso >= bail.overdueSinceIso;
    const override = bail.paymentOverrides?.[ym];
    const paidDay = override?.day ?? Math.min(28, bail.dueDay + (hashOf(`${bail.id}${ym}`) % 4));
    const paidIso = toIso(parseDay(dueIso).year, parseDay(dueIso).month, paidDay);
    result.push({
      id: ym,
      dueIso,
      calledMinor: calledMinor(bail),
      collectedMinor: unpaid ? 0 : calledMinor(bail),
      state: unpaid ? "impaye" : "paye",
      ...(unpaid ? {} : { paidIso }),
      mode: override?.mode ?? bail.paymentMode,
    });
  }
  return result.reverse();
}

export interface ReversementLine {
  id: string;
  month: string;
  payoutIso: string;
  collectedMinor: number;
  feeMinor: number;
  netMinor: number;
}

export function reversementsOf(index: Portefeuille, mandantId: string): ReversementLine[] {
  const mandat = index.activeMandat(mandantId);
  if (!mandat) return [];
  const schedules = index
    .biensOfMandat(mandat.id)
    .flatMap((bien) => index.data.baux.filter((bail) => bail.bienId === bien.id && bail.status !== "brouillon"))
    .map((bail) => buildSchedule(bail, index.data.todayIso));
  const months = new Set(schedules.flatMap((schedule) => schedule.map((echeance) => echeance.id)));
  const currentMonth = yearMonth(index.data.todayIso);
  const firstMonth = yearMonth(addMonths(mandat.startIso, 1));
  return [...months]
    .filter((month) => month < currentMonth && month >= firstMonth)
    .sort()
    .reverse()
    .map((month) => {
      const collected = schedules.reduce(
        (sum, schedule) => sum + (schedule.find((echeance) => echeance.id === month)?.collectedMinor ?? 0),
        0,
      );
      const fee = applyRate(collected, mandat.feeBasisPoints);
      const next = addMonths(`${month}-01`, 1);
      return { id: month, month, payoutIso: `${yearMonth(next)}-${String(mandat.payoutDay).padStart(2, "0")}`, collectedMinor: collected, feeMinor: fee, netMinor: collected - fee };
    });
}

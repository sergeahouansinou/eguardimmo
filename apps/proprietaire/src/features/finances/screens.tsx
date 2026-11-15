"use client";

import {
  AcompteFormPage,
  BilanPage,
  DepenseFormPage,
  FactureDocumentPage,
  FactureFormPage,
  FacturesPage,
  FinancesPage,
  ImportBancairePage,
  ImpayesPage,
  PaiementFormPage,
  PretsPage,
  RecouvrementPage,
  RecuDocumentPage,
  RegularisationPage,
} from "@eguardimmo/gestion/finances";
import { useSearchParams } from "next/navigation";
import { bindFinances } from "./bind";

export const FinancesScreen = bindFinances(FinancesPage);
export const ImpayesScreen = bindFinances(ImpayesPage);
export const RecouvrementScreen = bindFinances<{ echeanceId: string }>(RecouvrementPage);
export const FacturesScreen = bindFinances(FacturesPage);
export const FactureFormScreen = bindFinances(FactureFormPage);
export const RecuScreen = bindFinances<{ recuId: string }>(RecuDocumentPage);
export const RegularisationScreen = bindFinances(RegularisationPage);
export const BilanScreen = bindFinances(BilanPage);
export const PretsScreen = bindFinances(PretsPage);
export const ImportBancaireScreen = bindFinances(ImportBancairePage);

const FactureDocument = bindFinances<{ factureId: string; autoPrint: boolean }>(FactureDocumentPage);
const PaiementForm = bindFinances<{ echeanceId: string | null }>(PaiementFormPage);
const AcompteForm = bindFinances<{ bailId: string | null }>(AcompteFormPage);
const DepenseForm = bindFinances<{ depenseId: string | null; ligneBancaireId: string | null }>(DepenseFormPage);

export function FactureScreen({ factureId }: { factureId: string }) {
  const params = useSearchParams();
  return <FactureDocument factureId={factureId} autoPrint={params.get("imprimer") === "1"} />;
}

export function PaiementScreen() {
  const params = useSearchParams();
  return <PaiementForm echeanceId={params.get("echeance")} />;
}

export function AcompteScreen() {
  const params = useSearchParams();
  return <AcompteForm bailId={params.get("bail")} />;
}

export function DepenseScreen() {
  const params = useSearchParams();
  return <DepenseForm depenseId={params.get("depense")} ligneBancaireId={params.get("banque")} />;
}

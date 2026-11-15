"use client";

import {
  AcompteFormPage,
  BilanPage,
  DepenseFormPage,
  FactureDocumentPage,
  FactureFormPage,
  FacturesPage,
  FinancesPage,
  GrandLivrePage,
  ImportBancairePage,
  ImpayesPage,
  PaiementFormPage,
  PretsPage,
  RecouvrementPage,
  RecuDocumentPage,
  RelancePage,
  RegularisationPage,
} from "@eguardimmo/gestion/finances";
import type { DepenseSuggestion } from "@eguardimmo/gestion/finances";
import { useSearchParams } from "next/navigation";
import { bindFinances } from "./bind";

export const FinancesScreen = bindFinances(FinancesPage);
export const ImpayesScreen = bindFinances(ImpayesPage);
export const RecouvrementScreen = bindFinances<{ echeanceId: string }>(RecouvrementPage);
export const GrandLivreScreen = bindFinances<{ echeanceId: string }>(GrandLivrePage);
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
const DepenseForm = bindFinances<{ depenseId: string | null; ligneBancaireId: string | null; suggestion: DepenseSuggestion | null }>(DepenseFormPage);
const RelanceForm = bindFinances<{ echeanceId: string; niveau: string | null }>(RelancePage);

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

const limited = (value: string | null, max: number) => (value ?? "").slice(0, max);

export function RelanceScreen({ echeanceId }: { echeanceId: string }) {
  const params = useSearchParams();
  return <RelanceForm echeanceId={echeanceId} niveau={params.get("niveau")} />;
}

export function DepenseScreen() {
  const params = useSearchParams();
  const bien = limited(params.get("bien"), 120);
  const suggestion: DepenseSuggestion | null =
    bien === ""
      ? null
      : { bien, fournisseur: limited(params.get("fournisseur"), 120), montant: limited(params.get("montant"), 12), description: limited(params.get("description"), 500) };
  return <DepenseForm depenseId={params.get("depense")} ligneBancaireId={params.get("banque")} suggestion={suggestion} />;
}

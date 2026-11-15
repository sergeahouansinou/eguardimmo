"use client";

import {
  AnalytiqueOccPage,
  AnalytiquePrevPage,
  AnalytiqueRentaPage,
  AnalytiqueRevDepPage,
  AnalytiqueVuePage,
  ApercuRapportPage,
  RapportLoyersPage,
  RapportsPage,
} from "@eguardimmo/gestion";
import { useSearchParams } from "next/navigation";
import { bindScreen } from "./bindScreen";

export const AnalytiqueVueScreen = bindScreen(AnalytiqueVuePage);
export const AnalytiqueRevDepScreen = bindScreen(AnalytiqueRevDepPage);
export const AnalytiquePrevScreen = bindScreen(AnalytiquePrevPage);
export const AnalytiqueOccScreen = bindScreen(AnalytiqueOccPage);
export const AnalytiqueRentaScreen = bindScreen(AnalytiqueRentaPage);
export const RapportsScreen = bindScreen(RapportsPage);

const RapportLoyers = bindScreen<{ search: string }>(RapportLoyersPage);
const ApercuRapport = bindScreen<{ search: string }>(ApercuRapportPage);

export function RapportLoyersScreen() {
  return <RapportLoyers search={useSearchParams().toString()} />;
}

export function ApercuRapportScreen() {
  return <ApercuRapport search={useSearchParams().toString()} />;
}

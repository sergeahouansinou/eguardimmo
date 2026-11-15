"use client";

import {
  AnalytiqueOccPage,
  AnalytiquePrevPage,
  AnalytiqueRentaPage,
  AnalytiqueRevDepPage,
  AnalytiqueVuePage,
  ApercuReportPage,
  ApercuRapportPage,
  RapportLoyersPage,
  RapportPage,
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

const Rapport = bindScreen<{ slug: string; search: string }>(RapportPage);
const ApercuReport = bindScreen<{ slug: string; search: string }>(ApercuReportPage);

export function RapportScreen({ slug }: { slug: string }) {
  return <Rapport slug={slug} search={useSearchParams().toString()} />;
}

export function ApercuReportScreen({ slug }: { slug: string }) {
  return <ApercuReport slug={slug} search={useSearchParams().toString()} />;
}

import type { Metadata } from "next";
import { FinancesPage } from "@/features/reglages/FinancesPage";
import { DefaultsPage } from "@/features/reglages/DefaultsPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Réglages, finances et honoraires" };

export default function Page() {
  return dataSource === "api" ? <DefaultsPage /> : <FinancesPage />;
}

import type { Metadata } from "next";
import { FinancesPage } from "@/features/reglages/FinancesPage";

export const metadata: Metadata = { title: "Réglages, finances et honoraires" };

export default function Page() {
  return <FinancesPage />;
}

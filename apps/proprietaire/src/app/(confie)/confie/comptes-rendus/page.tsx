import type { Metadata } from "next";
import { ComptesRendusScreen } from "@/features/confie/screens/ComptesRendusScreen";
import { dataSource } from "@/lib/env";
import { ReportsScreen } from "@/owner/reports/ReportsScreen";

export const metadata: Metadata = { title: "Comptes rendus" };

export default function Page() {
  return dataSource === "api" ? <ReportsScreen /> : <ComptesRendusScreen />;
}

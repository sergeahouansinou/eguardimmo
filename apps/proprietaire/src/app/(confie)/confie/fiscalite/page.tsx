import type { Metadata } from "next";
import { FiscaliteScreen } from "@/features/confie/screens/FiscaliteScreen";
import { dataSource } from "@/lib/env";
import { TaxStatementsScreen } from "@/owner/tax/TaxStatementsScreen";

export const metadata: Metadata = { title: "Fiscalité" };

export default function Page() {
  return dataSource === "api" ? <TaxStatementsScreen /> : <FiscaliteScreen />;
}

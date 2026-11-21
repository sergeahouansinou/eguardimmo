import type { Metadata } from "next";
import { BanqueImportApiScreen } from "@/features/finances/apiScreens";
import { ImportBancaireScreen } from "@/features/finances/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Import bancaire" };

export default function Page() {
  return dataSource === "api" ? <BanqueImportApiScreen /> : <ImportBancaireScreen />;
}

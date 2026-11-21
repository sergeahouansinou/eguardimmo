import type { Metadata } from "next";
import { ImpayesScreen } from "@/features/finances/screens";
import { ImpayesRecouvrementScreen } from "@/features/recouvrement/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Impayés" };

export default function Page() {
  if (dataSource === "api") return <ImpayesRecouvrementScreen />;
  return <ImpayesScreen />;
}

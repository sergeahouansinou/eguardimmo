import type { Metadata } from "next";
import { ImpayesScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Impayés" };

export default function Page() {
  return <ImpayesScreen />;
}

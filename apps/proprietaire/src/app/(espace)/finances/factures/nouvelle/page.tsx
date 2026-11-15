import type { Metadata } from "next";
import { FactureFormScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default function Page() {
  return <FactureFormScreen />;
}

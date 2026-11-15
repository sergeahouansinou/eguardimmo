import type { Metadata } from "next";
import { QuittancesScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Quittances" };

export default function Page() {
  return <QuittancesScreen />;
}

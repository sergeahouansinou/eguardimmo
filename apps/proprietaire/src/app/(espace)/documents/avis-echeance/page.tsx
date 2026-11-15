import type { Metadata } from "next";
import { AvisEcheanceScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Avis d’échéance" };

export default function Page() {
  return <AvisEcheanceScreen />;
}

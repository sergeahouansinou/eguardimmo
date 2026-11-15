import type { Metadata } from "next";
import { EtatLieuxFormScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouvel état des lieux" };

export default function Page() {
  return <EtatLieuxFormScreen />;
}

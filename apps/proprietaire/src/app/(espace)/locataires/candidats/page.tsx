import type { Metadata } from "next";
import { CandidatsScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Candidats" };

export default function Page() {
  return <CandidatsScreen />;
}

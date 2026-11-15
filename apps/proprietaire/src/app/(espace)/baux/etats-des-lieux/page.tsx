import type { Metadata } from "next";
import { EtatsLieuxScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "États des lieux" };

export default function Page() {
  return <EtatsLieuxScreen />;
}

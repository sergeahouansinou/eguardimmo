import type { Metadata } from "next";
import { AcompteScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Enregistrer un acompte" };

export default function Page() {
  return <AcompteScreen />;
}

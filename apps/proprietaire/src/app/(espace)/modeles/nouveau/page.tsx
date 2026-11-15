import type { Metadata } from "next";
import { ModeleFormScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouveau modèle" };

export default function Page() {
  return <ModeleFormScreen />;
}

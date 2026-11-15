import type { Metadata } from "next";
import { ModelesScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Modèles de courriers" };

export default function Page() {
  return <ModelesScreen />;
}

import type { Metadata } from "next";
import { InscriptionChoixScreen } from "@/features/inscription/InscriptionChoixScreen";

export const metadata: Metadata = { title: "Créer un compte" };

export default function Page() {
  return <InscriptionChoixScreen />;
}

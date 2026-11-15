import type { Metadata } from "next";
import { RetourRefuseScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Adresse de retour refusée" };

export default function Page() {
  return <RetourRefuseScreen />;
}

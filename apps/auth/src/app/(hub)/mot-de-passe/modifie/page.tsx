import type { Metadata } from "next";
import { MotDePasseModifieScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Mot de passe modifié" };

export default function Page() {
  return <MotDePasseModifieScreen />;
}

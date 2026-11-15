import type { Metadata } from "next";
import { MotDePasseNouveauScreen } from "@/features/mot-de-passe/MotDePasseScreens";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function Page() {
  return <MotDePasseNouveauScreen />;
}

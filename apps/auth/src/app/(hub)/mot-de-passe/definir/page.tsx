import type { Metadata } from "next";
import { DefinirMotDePasseScreen } from "@/features/mot-de-passe/MotDePasseScreens";

export const metadata: Metadata = { title: "Définir un mot de passe" };

export default function Page() {
  return <DefinirMotDePasseScreen />;
}

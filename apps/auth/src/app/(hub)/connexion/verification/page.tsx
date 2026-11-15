import type { Metadata } from "next";
import { TwoFactorScreen } from "@/features/connexion/TwoFactorScreens";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

export default function Page() {
  return <TwoFactorScreen />;
}

import type { Metadata } from "next";
import { EmailVerifieScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Adresse vérifiée" };

export default function Page() {
  return <EmailVerifieScreen />;
}

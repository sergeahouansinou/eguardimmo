import type { Metadata } from "next";
import { ConfirmerEmailScreen } from "@/features/inscription/VerificationEmailScreens";

export const metadata: Metadata = { title: "Vérification de l’adresse" };

export default function Page() {
  return <ConfirmerEmailScreen />;
}

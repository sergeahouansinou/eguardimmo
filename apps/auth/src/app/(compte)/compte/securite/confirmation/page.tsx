import type { Metadata } from "next";
import { ConfirmerMotDePasseScreen } from "@/features/compte/ConfirmationScreens";

export const metadata: Metadata = { title: "Confirmer le mot de passe" };

export default function Page() {
  return <ConfirmerMotDePasseScreen />;
}

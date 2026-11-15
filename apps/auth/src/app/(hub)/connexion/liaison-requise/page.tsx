import type { Metadata } from "next";
import { LiaisonRequiseScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Un compte existe déjà avec cet e-mail" };

export default function Page() {
  return <LiaisonRequiseScreen />;
}

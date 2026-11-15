import type { Metadata } from "next";
import { ProfilsScreen } from "@/features/espaces/ProfilsScreen";

export const metadata: Metadata = { title: "Choix du profil" };

export default function Page() {
  return <ProfilsScreen />;
}

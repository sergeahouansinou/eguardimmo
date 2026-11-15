import type { Metadata } from "next";
import { DeconnecteScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Déconnexion" };

export default function Page() {
  return <DeconnecteScreen />;
}

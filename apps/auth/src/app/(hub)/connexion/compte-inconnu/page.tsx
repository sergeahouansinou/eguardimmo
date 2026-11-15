import type { Metadata } from "next";
import { CompteInconnuScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Aucun compte trouvé" };

export default function Page() {
  return <CompteInconnuScreen />;
}

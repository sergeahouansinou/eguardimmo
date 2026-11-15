import type { Metadata } from "next";
import { ContinuerScreen } from "@/features/espaces/ContinuerScreen";

export const metadata: Metadata = { title: "Connexion réussie" };

export default function Page() {
  return <ContinuerScreen />;
}

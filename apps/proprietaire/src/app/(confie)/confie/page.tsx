import type { Metadata } from "next";
import { AccueilScreen } from "@/features/confie/screens/AccueilScreen";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  return <AccueilScreen />;
}

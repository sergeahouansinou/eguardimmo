import type { Metadata } from "next";
import { TacheFormScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Nouvelle tâche" };

export default function Page() {
  return <TacheFormScreen />;
}

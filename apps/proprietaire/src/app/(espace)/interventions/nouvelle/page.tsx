import type { Metadata } from "next";
import { InterventionFormScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Nouvelle intervention" };

export default function Page() {
  return <InterventionFormScreen />;
}

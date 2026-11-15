import type { Metadata } from "next";
import { LiaisonConflitScreen } from "@/features/compte/ComptesLiesScreens";

export const metadata: Metadata = { title: "Liaison impossible" };

export default function Page() {
  return <LiaisonConflitScreen />;
}

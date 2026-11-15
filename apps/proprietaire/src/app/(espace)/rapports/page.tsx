import type { Metadata } from "next";
import { RapportsScreen } from "@/features/outils/screensOutils";

export const metadata: Metadata = { title: "Rapports" };

export default function Page() {
  return <RapportsScreen />;
}

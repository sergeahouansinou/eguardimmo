import type { Metadata } from "next";
import { PretsScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Prêts immobiliers" };

export default function Page() {
  return <PretsScreen />;
}

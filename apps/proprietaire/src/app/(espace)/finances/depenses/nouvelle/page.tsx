import type { Metadata } from "next";
import { DepenseScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Ajouter une dépense" };

export default function Page() {
  return <DepenseScreen />;
}

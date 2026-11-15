import type { Metadata } from "next";
import { RegularisationScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Régularisation des charges" };

export default function Page() {
  return <RegularisationScreen />;
}

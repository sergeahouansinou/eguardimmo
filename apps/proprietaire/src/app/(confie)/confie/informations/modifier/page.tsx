import type { Metadata } from "next";
import { InformationsModifierScreen } from "@/features/confie/screens/InformationsModifierScreen";

export const metadata: Metadata = { title: "Modifier mes informations" };

export default function Page() {
  return <InformationsModifierScreen />;
}

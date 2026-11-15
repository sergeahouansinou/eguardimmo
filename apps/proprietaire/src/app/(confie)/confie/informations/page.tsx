import type { Metadata } from "next";
import { InformationsScreen } from "@/features/confie/screens/InformationsScreen";

export const metadata: Metadata = { title: "Mes informations" };

export default function Page() {
  return <InformationsScreen />;
}

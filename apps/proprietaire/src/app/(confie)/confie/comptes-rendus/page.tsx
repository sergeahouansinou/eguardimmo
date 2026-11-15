import type { Metadata } from "next";
import { ComptesRendusScreen } from "@/features/confie/screens/ComptesRendusScreen";

export const metadata: Metadata = { title: "Comptes rendus" };

export default function Page() {
  return <ComptesRendusScreen />;
}

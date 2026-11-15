import type { Metadata } from "next";
import { MesBiensScreen } from "@/features/confie/screens/MesBiensScreen";

export const metadata: Metadata = { title: "Mes biens" };

export default function Page() {
  return <MesBiensScreen />;
}

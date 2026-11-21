import type { Metadata } from "next";
import { MesBiensScreen } from "@/features/confie/screens/MesBiensScreen";
import { dataSource } from "@/lib/env";
import { PropertiesScreen } from "@/owner/properties/PropertiesScreen";

export const metadata: Metadata = { title: "Mes biens" };

export default function Page() {
  return dataSource === "api" ? <PropertiesScreen /> : <MesBiensScreen />;
}

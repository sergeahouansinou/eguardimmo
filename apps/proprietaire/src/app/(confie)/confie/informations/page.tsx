import type { Metadata } from "next";
import { InformationsScreen } from "@/features/confie/screens/InformationsScreen";
import { dataSource } from "@/lib/env";
import { ApiInformationsScreen } from "@/owner/account/AccountScreens";

export const metadata: Metadata = { title: "Mes informations" };

export default function Page() {
  return dataSource === "api" ? <ApiInformationsScreen /> : <InformationsScreen />;
}

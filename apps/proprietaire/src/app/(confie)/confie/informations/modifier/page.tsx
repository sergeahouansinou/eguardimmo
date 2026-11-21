import type { Metadata } from "next";
import { InformationsModifierScreen } from "@/features/confie/screens/InformationsModifierScreen";
import { dataSource } from "@/lib/env";
import { ApiModifierScreen } from "@/owner/account/AccountScreens";

export const metadata: Metadata = { title: "Modifier mes informations" };

export default function Page() {
  return dataSource === "api" ? <ApiModifierScreen /> : <InformationsModifierScreen />;
}

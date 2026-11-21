import type { Metadata } from "next";
import { ContactsApiScreen } from "@/features/outils/screensOrg";
import { ContactsScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Carnet de contacts" };

export default function Page() {
  return dataSource === "api" ? <ContactsApiScreen /> : <ContactsScreen />;
}

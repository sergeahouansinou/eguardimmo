import type { Metadata } from "next";
import { ContactFormApiScreen } from "@/features/outils/screensOrg";
import { ContactFormScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouveau contact" };

export default function Page() {
  return dataSource === "api" ? <ContactFormApiScreen /> : <ContactFormScreen />;
}

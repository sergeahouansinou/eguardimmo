import type { Metadata } from "next";
import { AgendaApiScreen } from "@/features/outils/screensOrg";
import { AgendaScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return dataSource === "api" ? <AgendaApiScreen /> : <AgendaScreen />;
}

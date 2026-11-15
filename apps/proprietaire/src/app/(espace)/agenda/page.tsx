import type { Metadata } from "next";
import { AgendaScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return <AgendaScreen />;
}

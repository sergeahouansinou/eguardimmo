import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { AgendaScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return <ApiOnly><AgendaScreen /></ApiOnly>;
}

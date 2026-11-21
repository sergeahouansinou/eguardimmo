import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { JournalScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Journal d’activité" };

export default function Page() {
  return <ApiOnly><JournalScreen /></ApiOnly>;
}

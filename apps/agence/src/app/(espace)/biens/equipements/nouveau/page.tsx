import { EquipementForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Nouvel équipement" };

export default function Page() {
  return <ApiOnly><EquipementForm /></ApiOnly>;
}

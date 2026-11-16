import { EquipementsScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Équipements" };

export default function Page() {
  return <ApiOnly><EquipementsScreen /></ApiOnly>;
}

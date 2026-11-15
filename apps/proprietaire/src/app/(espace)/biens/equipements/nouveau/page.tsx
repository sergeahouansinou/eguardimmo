import { EquipementForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouvel équipement" };

export default function Page() {
  return <EquipementForm />;
}

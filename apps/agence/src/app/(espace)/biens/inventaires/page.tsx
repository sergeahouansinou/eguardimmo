import { InventairesScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Inventaires" };

export default function Page() {
  return <ApiOnly><InventairesScreen /></ApiOnly>;
}

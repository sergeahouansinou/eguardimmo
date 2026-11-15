import { InventairesScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inventaires" };

export default function Page() {
  return <InventairesScreen />;
}

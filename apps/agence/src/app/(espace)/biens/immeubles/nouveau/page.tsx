import { ImmeubleForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Nouvel immeuble" };

export default function Page() {
  return <ApiOnly><ImmeubleForm /></ApiOnly>;
}

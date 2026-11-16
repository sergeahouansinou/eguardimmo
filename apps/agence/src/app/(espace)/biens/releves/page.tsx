import { RelevesScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Relevés de compteurs" };

export default function Page() {
  return <ApiOnly><RelevesScreen /></ApiOnly>;
}

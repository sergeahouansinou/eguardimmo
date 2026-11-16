import type { Metadata } from "next";
import { EtatLieuxFormScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Nouvel état des lieux" };

export default function Page() {
  return <ApiOnly><EtatLieuxFormScreen /></ApiOnly>;
}

import type { Metadata } from "next";
import { CandidatsScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Candidats" };

export default function Page() {
  return <ApiOnly><CandidatsScreen /></ApiOnly>;
}

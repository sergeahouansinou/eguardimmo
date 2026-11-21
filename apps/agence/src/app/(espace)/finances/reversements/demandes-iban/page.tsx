import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { DemandesIbanApiScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Changements d’IBAN" };

export default function Page() {
  return <ApiOnly><DemandesIbanApiScreen /></ApiOnly>;
}

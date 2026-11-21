import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { BanqueComptesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Comptes bancaires" };

export default function Page() {
  return <ApiOnly><BanqueComptesScreen /></ApiOnly>;
}

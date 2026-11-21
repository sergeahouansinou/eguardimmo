import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { BanqueEtatsScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "États de rapprochement" };

export default function Page() {
  return <ApiOnly><BanqueEtatsScreen /></ApiOnly>;
}

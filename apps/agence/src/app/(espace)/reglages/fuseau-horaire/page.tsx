import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { FuseauHoraireScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Réglages, fuseau horaire" };

export default function Page() {
  return <ApiOnly><FuseauHoraireScreen /></ApiOnly>;
}

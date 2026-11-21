import type { Metadata } from "next";
import { ApiOnly } from "@/features/finances/gates";
import { FuseauHoraireApiScreen } from "@/features/outils/screensOrg";

export const metadata: Metadata = { title: "Réglages, fuseau horaire" };

export default function Page() {
  return <ApiOnly><FuseauHoraireApiScreen /></ApiOnly>;
}

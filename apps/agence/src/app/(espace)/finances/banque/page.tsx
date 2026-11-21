import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { BanquePointageScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Pointage bancaire" };

export default function Page() {
  return <ApiOnly><BanquePointageScreen /></ApiOnly>;
}

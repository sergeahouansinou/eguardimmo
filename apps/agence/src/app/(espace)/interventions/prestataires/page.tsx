import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { PrestatairesApiScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Prestataires" };

export default function Page() {
  return <ApiOnly><PrestatairesApiScreen /></ApiOnly>;
}

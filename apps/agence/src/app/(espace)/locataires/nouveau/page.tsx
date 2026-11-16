import type { Metadata } from "next";
import { LocataireFormScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Nouveau locataire" };

export default function Page() {
  return <ApiOnly><LocataireFormScreen /></ApiOnly>;
}

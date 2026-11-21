import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { DossiersRecouvrementScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Recouvrement" };

export default function Page() {
  return <ApiOnly><DossiersRecouvrementScreen /></ApiOnly>;
}

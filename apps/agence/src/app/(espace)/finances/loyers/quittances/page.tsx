import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { LoyersQuittancesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Quittances de loyer" };

export default function Page() {
  return <ApiOnly><LoyersQuittancesScreen /></ApiOnly>;
}

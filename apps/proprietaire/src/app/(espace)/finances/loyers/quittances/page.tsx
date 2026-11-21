import type { Metadata } from "next";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { LoyersQuittancesScreen } from "@/features/loyers/screens";

export const metadata: Metadata = { title: "Quittances de loyer" };

export default function Page() {
  return <ApiOnly><LoyersQuittancesScreen /></ApiOnly>;
}

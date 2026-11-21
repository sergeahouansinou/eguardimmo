import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { LoyersScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Loyers" };

export default function Page() {
  return <ApiOnly><LoyersScreen /></ApiOnly>;
}

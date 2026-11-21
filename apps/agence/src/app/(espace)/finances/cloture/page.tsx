import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ClotureApiScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Clôture mensuelle" };

export default function Page() {
  return <ApiOnly><ClotureApiScreen /></ApiOnly>;
}

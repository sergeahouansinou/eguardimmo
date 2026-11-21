import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { DepenseFormScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Nouvelle dépense" };

export default function Page() {
  return <ApiOnly><DepenseFormScreen /></ApiOnly>;
}

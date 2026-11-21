import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ChargesClesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Clés de répartition" };

export default function Page() {
  return <ApiOnly><ChargesClesScreen /></ApiOnly>;
}

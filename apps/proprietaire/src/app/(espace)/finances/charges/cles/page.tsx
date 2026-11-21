import type { Metadata } from "next";
import { ChargesClesApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Clés de répartition" };

export default function Page() {
  return <ApiOnly><ChargesClesApiScreen /></ApiOnly>;
}

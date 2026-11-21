import type { Metadata } from "next";
import { BanqueRelevesApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Relevés bancaires" };

export default function Page() {
  return <ApiOnly><BanqueRelevesApiScreen /></ApiOnly>;
}

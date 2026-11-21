import type { Metadata } from "next";
import { FiscaliteApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Fiscalité" };

export default function Page() {
  return <ApiOnly><FiscaliteApiScreen /></ApiOnly>;
}

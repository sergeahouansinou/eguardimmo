import type { Metadata } from "next";
import { DepensesApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Dépenses" };

export default function Page() {
  return <ApiOnly><DepensesApiScreen /></ApiOnly>;
}

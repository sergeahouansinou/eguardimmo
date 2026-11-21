import type { Metadata } from "next";
import { BanquePointageApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Pointage bancaire" };

export default function Page() {
  return <ApiOnly><BanquePointageApiScreen /></ApiOnly>;
}

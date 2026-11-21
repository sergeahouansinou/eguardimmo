import type { Metadata } from "next";
import { BanqueComptesApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Comptes bancaires" };

export default function Page() {
  return <ApiOnly><BanqueComptesApiScreen /></ApiOnly>;
}

import type { Metadata } from "next";
import { BanqueEtatsApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "États de rapprochement" };

export default function Page() {
  return <ApiOnly><BanqueEtatsApiScreen /></ApiOnly>;
}

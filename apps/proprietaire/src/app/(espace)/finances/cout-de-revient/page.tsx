import type { Metadata } from "next";
import { CoutDeRevientApiScreen } from "@/features/finances/apiScreens";
import { ApiOnly } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Coût de revient des biens" };

export default function Page() {
  return <ApiOnly><CoutDeRevientApiScreen /></ApiOnly>;
}

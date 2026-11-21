import type { Metadata } from "next";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { DossiersRecouvrementScreen } from "@/features/recouvrement/screens";

export const metadata: Metadata = { title: "Recouvrement" };

export default function Page() {
  return <ApiOnly><DossiersRecouvrementScreen /></ApiOnly>;
}

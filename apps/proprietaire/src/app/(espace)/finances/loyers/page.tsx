import type { Metadata } from "next";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { LoyersScreen } from "@/features/loyers/screens";

export const metadata: Metadata = { title: "Loyers" };

export default function Page() {
  return <ApiOnly><LoyersScreen /></ApiOnly>;
}

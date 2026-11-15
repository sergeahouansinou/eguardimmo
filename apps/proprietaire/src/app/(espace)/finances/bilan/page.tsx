import type { Metadata } from "next";
import { BilanScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Bilan" };

export default function Page() {
  return <BilanScreen />;
}

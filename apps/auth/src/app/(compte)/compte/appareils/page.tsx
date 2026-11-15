import type { Metadata } from "next";
import { AppareilsScreen } from "@/features/compte/AppareilsScreen";

export const metadata: Metadata = { title: "Appareils connectés" };

export default function Page() {
  return <AppareilsScreen />;
}

import type { Metadata } from "next";
import { PlannedFinances } from "@/features/finances/PlannedFinances";

export const metadata: Metadata = { title: "Grand livre" };

export default function Page() {
  return <PlannedFinances title="Grand livre" />;
}

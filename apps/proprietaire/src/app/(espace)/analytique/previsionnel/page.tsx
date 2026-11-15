import type { Metadata } from "next";
import { AnalytiquePrevScreen } from "@/features/outils/screensOutils";

export const metadata: Metadata = { title: "Prévisionnel" };

export default function Page() {
  return <AnalytiquePrevScreen />;
}

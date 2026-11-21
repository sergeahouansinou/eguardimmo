import type { Metadata } from "next";
import { AnalytiquePrevApiScreen } from "@/features/outils/screensOrg";
import { AnalytiquePrevScreen } from "@/features/outils/screensOutils";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Prévisionnel" };

export default function Page() {
  return dataSource === "api" ? <AnalytiquePrevApiScreen /> : <AnalytiquePrevScreen />;
}

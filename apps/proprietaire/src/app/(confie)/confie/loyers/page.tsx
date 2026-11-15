import type { Metadata } from "next";
import { LoyersScreen } from "@/features/confie/screens/LoyersScreen";

export const metadata: Metadata = { title: "Loyers et reversements" };

export default function Page() {
  return <LoyersScreen />;
}

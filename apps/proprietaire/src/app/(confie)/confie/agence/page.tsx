import type { Metadata } from "next";
import { AgenceScreen } from "@/features/confie/screens/AgenceScreen";

export const metadata: Metadata = { title: "Mon agence" };

export default function Page() {
  return <AgenceScreen />;
}

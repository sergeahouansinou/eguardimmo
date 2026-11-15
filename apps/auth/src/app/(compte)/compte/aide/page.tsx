import type { Metadata } from "next";
import { AideScreen } from "@/features/compte/AideScreen";

export const metadata: Metadata = { title: "Aide" };

export default function Page() {
  return <AideScreen />;
}

import type { Metadata } from "next";
import { CodesSecoursScreen } from "@/features/compte/CodesSecoursScreen";

export const metadata: Metadata = { title: "Codes de secours" };

export default function Page() {
  return <CodesSecoursScreen />;
}

import type { Metadata } from "next";
import { BureauScreen } from "./BureauScreen";

export const metadata: Metadata = { title: "Accueil" };

export default function Page() {
  return <BureauScreen />;
}

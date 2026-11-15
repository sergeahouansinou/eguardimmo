import type { Metadata } from "next";
import { PlannedScreen } from "@eguardimmo/shell";

export const metadata: Metadata = { title: "Aide" };

export default function Page() {
  return <PlannedScreen title="Aide" description="Le centre d’aide est livré avec le module d’aide et de support." />;
}

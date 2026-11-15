import type { Metadata } from "next";
import { Activation2FAScreen } from "@/features/compte/Activation2FAScreen";

export const metadata: Metadata = { title: "Activer la double authentification" };

export default function Page() {
  return <Activation2FAScreen />;
}

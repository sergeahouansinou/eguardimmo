import type { Metadata } from "next";
import { ConfirmerCodeScreen } from "@/features/compte/ConfirmationScreens";

export const metadata: Metadata = { title: "Confirmer avec un code" };

export default function Page() {
  return <ConfirmerCodeScreen />;
}

import type { Metadata } from "next";
import { MotDePasseOublieScreen } from "@/features/mot-de-passe/MotDePasseScreens";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function Page() {
  return <MotDePasseOublieScreen />;
}

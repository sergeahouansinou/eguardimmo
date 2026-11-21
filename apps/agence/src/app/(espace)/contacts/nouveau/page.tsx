import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ContactFormScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Nouveau contact" };

export default function Page() {
  return <ApiOnly><ContactFormScreen /></ApiOnly>;
}

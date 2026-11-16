import { ImmeublesScreen } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Immeubles" };

export default function Page() {
  return <ApiOnly><ImmeublesScreen /></ApiOnly>;
}

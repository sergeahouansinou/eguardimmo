import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { ContactsScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <ApiOnly><ContactsScreen /></ApiOnly>;
}

import type { Metadata } from "next";
import { ContactFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier le contact" };

export default function Page({ params }: PageProps<"/contacts/[id]/modifier">) {
  return <WithId params={params}>{(id) => <ContactFormScreen id={id} />}</WithId>;
}

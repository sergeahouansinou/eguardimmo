import type { Metadata } from "next";
import { ContactDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Contact" };

export default function Page({ params }: PageProps<"/contacts/[id]">) {
  return <WithId params={params}>{(id) => <ContactDetailScreen id={id} />}</WithId>;
}

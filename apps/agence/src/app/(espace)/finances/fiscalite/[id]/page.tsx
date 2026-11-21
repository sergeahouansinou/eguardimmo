import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { FiscaliteDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Relevé fiscal" };

export default function Page({ params }: PageProps<"/finances/fiscalite/[id]">) {
  return <WithId params={params} fallback={<PageSkeleton />}>{(id) => <FiscaliteDetailScreen id={id} />}</WithId>;
}

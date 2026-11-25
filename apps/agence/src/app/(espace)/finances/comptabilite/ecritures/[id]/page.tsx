import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EntryDetailPage } from "@/features/comptabilite/EntryDetailPage";
import { WithRouteId } from "@/features/org/WithRouteId";

export const metadata: Metadata = { title: "Écriture comptable" };

export default function Page({ params }: PageProps<"/finances/comptabilite/ecritures/[id]">) {
  return <WithRouteId params={params} fallback={<PageSkeleton />}>{(id) => <EntryDetailPage id={id} />}</WithRouteId>;
}

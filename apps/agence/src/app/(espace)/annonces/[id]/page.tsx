import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { ListingDetailPage } from "@/features/annonces/ListingDetailPage";
import { WithRouteId } from "@/features/org/WithRouteId";

export const metadata: Metadata = { title: "Annonce" };

export default function Page({ params }: PageProps<"/annonces/[id]">) {
  return <WithRouteId params={params} fallback={<PageSkeleton />}>{(id) => <ListingDetailPage id={id} />}</WithRouteId>;
}

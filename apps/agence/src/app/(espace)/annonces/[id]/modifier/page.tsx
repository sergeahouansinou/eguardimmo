import type { Metadata } from "next";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { EditListingPage } from "@/features/annonces/EditListingPage";
import { WithRouteId } from "@/features/org/WithRouteId";

export const metadata: Metadata = { title: "Modifier l’annonce" };

export default function Page({ params }: PageProps<"/annonces/[id]/modifier">) {
  return <WithRouteId params={params} fallback={<PageSkeleton />}>{(id) => <EditListingPage id={id} />}</WithRouteId>;
}

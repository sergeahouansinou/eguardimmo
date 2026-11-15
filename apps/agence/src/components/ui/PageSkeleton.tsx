import { Skeleton } from "@eguardimmo/ui";

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Chargement de la page" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton shape="block" className="h-32" />
    </div>
  );
}

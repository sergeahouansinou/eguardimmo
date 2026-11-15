import { Alert, Skeleton } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface QueryStateProps<T> {
  query: { data: T | undefined; isError: boolean; isPending: boolean };
  label: string;
  children: (data: T) => ReactNode;
}

export function QueryState<T>({ query, label, children }: QueryStateProps<T>) {
  if (query.isError) {
    return (
      <Alert tone="danger" title={`${label} n'a pas pu être chargé`}>
        Rechargez la page. Si le problème persiste, contactez le support.
      </Alert>
    );
  }
  if (query.isPending || query.data === undefined) {
    return (
      <div role="status" aria-label={`Chargement : ${label}`} className="flex flex-col gap-3">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton shape="block" className="h-32" />
        <Skeleton shape="block" className="h-48" />
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

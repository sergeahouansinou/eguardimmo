import { LotFiche } from "@eguardimmo/gestion/biens";
import type { ReactNode } from "react";
import { WithId } from "@/features/gestion/WithId";
import { dataSource } from "@/lib/env";

export default function Layout({ children, params }: LayoutProps<"/biens/[id]">) {
  if (dataSource !== "api") return children;
  const skeleton = (
    <>
      <div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />
      {children}
    </>
  );
  return <WithId params={params} fallback={skeleton}>{(id): ReactNode => <LotFiche id={id}>{children}</LotFiche>}</WithId>;
}

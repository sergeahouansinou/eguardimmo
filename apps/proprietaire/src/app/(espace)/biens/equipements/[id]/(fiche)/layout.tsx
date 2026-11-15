import { EquipementFiche } from "@eguardimmo/gestion/biens";
import type { ReactNode } from "react";
import { WithId } from "../../../WithId";

export default function Layout({ children, params }: LayoutProps<"/biens/equipements/[id]">) {
  const skeleton = (
    <>
      <div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />
      {children}
    </>
  );
  return <WithId params={params} fallback={skeleton}>{(id): ReactNode => <EquipementFiche id={id}>{children}</EquipementFiche>}</WithId>;
}

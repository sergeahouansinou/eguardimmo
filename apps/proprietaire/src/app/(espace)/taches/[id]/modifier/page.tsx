import { demoTasks } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiWithId } from "@/features/finances/gates";
import { TacheFormApiScreen } from "@/features/outils/screensOrg";
import { TacheFormScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Modifier la tâche" };

export function generateStaticParams() {
  return demoTasks.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/taches/[id]/modifier">) {
  if (dataSource === "api") return <ApiWithId params={params}>{(id) => <TacheFormApiScreen id={id} />}</ApiWithId>;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/taches/[id]/modifier">, "params">) {
  const { id } = await params;
  return <TacheFormScreen id={id} />;
}

import { demoContacts } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiWithId } from "@/features/finances/gates";
import { ContactDetailApiScreen } from "@/features/outils/screensOrg";
import { ContactDetailScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Contact" };

export function generateStaticParams() {
  return demoContacts.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/contacts/[id]">) {
  if (dataSource === "api") return <ApiWithId params={params}>{(id) => <ContactDetailApiScreen id={id} />}</ApiWithId>;
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  const { id } = await params;
  return <ContactDetailScreen id={id} />;
}

import { demoContacts } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactDetailScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Contact" };

export function generateStaticParams() {
  return demoContacts.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/contacts/[id]">) {
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

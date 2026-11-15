import { demoContacts } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactFormScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Modifier le contact" };

export function generateStaticParams() {
  return demoContacts.map(({ id }) => ({ id }));
}

export default function Page({ params }: PageProps<"/contacts/[id]/modifier">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/contacts/[id]/modifier">, "params">) {
  const { id } = await params;
  return <ContactFormScreen id={id} />;
}

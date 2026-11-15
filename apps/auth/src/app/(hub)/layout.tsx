import Image from "next/image";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { Spinner } from "@eguardimmo/ui";

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Image src="/logo.png" alt="eGuardImmo" width={24} height={24} className="size-6 rounded-full" priority />
        <span className="inline-flex h-7 items-center rounded-sm bg-action-subtle px-2.5 text-caption font-semibold text-action-on-subtle md:text-[13px]">
          Authentification
        </span>
      </header>
      <main id="contenu" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 py-8 md:pt-12">
        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Spinner size={32} label="Chargement" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}

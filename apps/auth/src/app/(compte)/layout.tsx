import { Suspense } from "react";
import type { ReactNode } from "react";
import { Spinner } from "@eguardimmo/ui";
import { AccountShell } from "@/features/compte/AccountShell";

export default function CompteLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner size={32} label="Chargement de votre compte" />
        </div>
      }
    >
      <AccountShell>{children}</AccountShell>
    </Suspense>
  );
}

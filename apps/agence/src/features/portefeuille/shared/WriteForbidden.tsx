import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";

export function WriteForbidden({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-page-title">{title}</h1>
      <Alert tone="warning" title="Action réservée">
        Votre rôle ne permet pas de modifier les mandats. Les rôles propriétaire, administrateur et gestionnaire peuvent le faire.
      </Alert>
      <div>
        <Button variant="secondary" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

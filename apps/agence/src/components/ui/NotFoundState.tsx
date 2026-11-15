import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";

export function NotFoundState({ title, description, backHref, backLabel }: { title: string; description: string; backHref: string; backLabel: string }) {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="text-page-title">{title}</h1>
      <Alert tone="warning" title="Introuvable">
        {description}
      </Alert>
      <div>
        <Button variant="secondary" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

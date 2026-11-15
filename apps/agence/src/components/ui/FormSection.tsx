import { Card, CardTitle } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card role="group" aria-label={title}>
      <CardTitle as="h2">{title}</CardTitle>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

import { Alert } from "@eguardimmo/ui";
import type { AlertTone } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export function ActionAlert({ tone, title, children, action }: { tone: AlertTone; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Alert tone={tone} title={title}>
      {children}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </Alert>
  );
}

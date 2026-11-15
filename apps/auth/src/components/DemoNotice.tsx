"use client";

import { Alert } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { useAuthSource } from "@/features/auth/source";

export function DemoNotice({ children }: { children: ReactNode }) {
  const source = useAuthSource();
  if (source.kind !== "demo") return null;
  return (
    <Alert tone="info" title="Mode démonstration" className="text-left">
      {children}
    </Alert>
  );
}

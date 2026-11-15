"use client";

import { ShellSourceProvider } from "@eguardimmo/shell";
import type { ShellSource } from "@eguardimmo/shell";
import { createContext, use } from "react";
import type { ReactNode } from "react";

export interface ConfieSource extends ShellSource {
  markNotificationRead: (id: string) => Promise<void>;
  snapshot: () => Promise<unknown>;
  decideQuote: (input: unknown) => Promise<void>;
  requestMandateEnd: (input: unknown) => Promise<void>;
  cancelMandateEnd: () => Promise<void>;
  updateProfile: (input: unknown) => Promise<void>;
  requestIbanChange: (input: unknown) => Promise<void>;
  addDocument: (input: unknown) => Promise<void>;
  savePreferences: (input: unknown) => Promise<void>;
  markReportViewed: (reportId: string) => Promise<void>;
}

const SourceContext = createContext<ConfieSource | null>(null);

export function ConfieSourceProvider({ source, children }: { source: ConfieSource; children: ReactNode }) {
  return (
    <SourceContext value={source}>
      <ShellSourceProvider source={source}>{children}</ShellSourceProvider>
    </SourceContext>
  );
}

export function useConfieSource(): ConfieSource {
  const source = use(SourceContext);
  if (!source) throw new Error("ConfieSourceProvider manquant autour de l'espace propriétaire mandant.");
  return source;
}

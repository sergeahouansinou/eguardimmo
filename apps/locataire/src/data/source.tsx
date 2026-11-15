'use client';

import { ShellSourceProvider } from '@eguardimmo/shell';
import type { ShellSource } from '@eguardimmo/shell';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { ProfileInput, PreferenceInput } from './schemas/compte';
import type { InterventionInput, RescheduleInput } from './schemas/interventions';
import type { AttestationInput, NoticeInput } from './schemas/logement';
import type { MandateInput, PaymentOutcome, StartPaymentInput } from './schemas/loyers';

export interface LocataireSource extends ShellSource {
  home: () => Promise<unknown>;
  lease: () => Promise<unknown>;
  installments: () => Promise<unknown>;
  payment: (id: string) => Promise<unknown>;
  receipt: (id: string) => Promise<unknown>;
  charges: () => Promise<unknown>;
  mandate: () => Promise<unknown>;
  inspections: () => Promise<unknown>;
  documents: () => Promise<unknown>;
  interventions: () => Promise<unknown>;
  attestations: () => Promise<unknown>;
  profile: () => Promise<unknown>;
  preferences: () => Promise<unknown>;
  security: () => Promise<unknown>;
  startPayment: (input: StartPaymentInput) => Promise<unknown>;
  resolvePayment: (input: { paymentId: string; outcome: PaymentOutcome }) => Promise<unknown>;
  settlePayment: (paymentId: string) => Promise<unknown>;
  signMandate: (input: MandateInput) => Promise<unknown>;
  revokeMandate: () => Promise<unknown>;
  createIntervention: (input: InterventionInput) => Promise<unknown>;
  rescheduleIntervention: (input: RescheduleInput) => Promise<unknown>;
  depositAttestation: (input: AttestationInput) => Promise<unknown>;
  giveNotice: (input: NoticeInput) => Promise<unknown>;
  updateProfile: (input: { values: ProfileInput; code?: string }) => Promise<unknown>;
  setPreference: (input: PreferenceInput) => Promise<unknown>;
  requestDataExport: () => Promise<unknown>;
}

const SourceContext = createContext<LocataireSource | null>(null);

export function LocataireSourceProvider({ source, children }: { source: LocataireSource; children: ReactNode }) {
  return (
    <ShellSourceProvider source={source}>
      <SourceContext value={source}>{children}</SourceContext>
    </ShellSourceProvider>
  );
}

export function useLocataireSource(): LocataireSource {
  const source = use(SourceContext);
  if (!source) throw new Error('LocataireSourceProvider manquant autour de l’espace locataire.');
  return source;
}

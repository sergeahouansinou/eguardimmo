import { DEMO_NOW, DEMO_TODAY, FIRST_NEW_PAYMENT_NUMBER, FIRST_NEW_RECEIPT_NUMBER, buildInstallments, buildSeedPayments, mandateFixture } from './fixtures/loyers';
import { attestationsFixture, documentsFixture, inspectionsFixture, leaseFixture } from './fixtures/logement';
import { homeFixture, interventionsFixture, notificationsFixture, preferencesFixture, profileFixture, securityFixture } from './fixtures/compte';
import type { ShellNotification } from '@eguardimmo/shell';
import type { HomeExtras, Preference, Profile, Security } from './schemas/compte';
import type { Intervention } from './schemas/interventions';
import type { Attestation, DemoDocument, Inspection, Lease } from './schemas/logement';
import type { Installment, Mandate, Payment } from './schemas/loyers';

export interface DemoState {
  today: string;
  now: string;
  lease: Lease;
  installments: Installment[];
  payments: Payment[];
  mandate: Mandate;
  inspections: Inspection[];
  documents: DemoDocument[];
  attestations: Attestation[];
  interventions: Intervention[];
  profile: Profile;
  preferences: Preference[];
  security: Security;
  home: HomeExtras;
  notifications: ShellNotification[];
  nextPaymentNumber: number;
  nextReceiptNumber: number;
  nextInterventionNumber: number;
  nextAttestationNumber: number;
}

export function createDemoState(): DemoState {
  const installments = buildInstallments();
  return {
    today: DEMO_TODAY,
    now: DEMO_NOW,
    lease: structuredClone(leaseFixture),
    installments,
    payments: buildSeedPayments(installments),
    mandate: structuredClone(mandateFixture),
    inspections: structuredClone(inspectionsFixture),
    documents: structuredClone(documentsFixture),
    attestations: structuredClone(attestationsFixture),
    interventions: structuredClone(interventionsFixture),
    profile: structuredClone(profileFixture),
    preferences: structuredClone(preferencesFixture),
    security: structuredClone(securityFixture),
    home: structuredClone(homeFixture),
    notifications: structuredClone(notificationsFixture),
    nextPaymentNumber: FIRST_NEW_PAYMENT_NUMBER,
    nextReceiptNumber: FIRST_NEW_RECEIPT_NUMBER,
    nextInterventionNumber: 148,
    nextAttestationNumber: 1,
  };
}

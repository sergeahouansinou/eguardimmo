import { demoSeeds } from '@eguardimmo/messagerie';
import { interventionsFixture } from './fixtures/compte';
import { inspectionsFixture } from './fixtures/logement';
import { buildInstallments, buildSeedPayments } from './fixtures/loyers';

const seedInstallments = buildInstallments();

export function paymentIds(): { id: string }[] {
  return buildSeedPayments(seedInstallments).slice(-1).map((payment) => ({ id: payment.id }));
}

export function receiptIds(): { id: string }[] {
  return seedInstallments.flatMap((item) => (item.receiptId ? [{ id: item.receiptId }] : [])).slice(-2);
}

export function inspectionIds(): { id: string }[] {
  return inspectionsFixture.map((item) => ({ id: item.id }));
}

export function interventionIds(): { id: string }[] {
  return interventionsFixture.map((item) => ({ id: item.id }));
}

export function conversationIds(): { id: string }[] {
  return demoSeeds.locataire().conversations.map((item) => ({ id: item.id }));
}

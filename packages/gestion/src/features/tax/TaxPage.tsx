'use client';

import { useOrgInfoSource } from '../orgapi/source';
import { LandlordTaxPage } from './LandlordTaxPage';
import { MandantStatementsPage } from './MandantStatementsPage';
import { SummaryDetailPage } from './SummaryDetailPage';

export function TaxPage() {
  const { kind } = useOrgInfoSource();
  return kind === 'agency' ? <MandantStatementsPage /> : <LandlordTaxPage />;
}

export function TaxDetailPage({ id }: { id: string }) {
  const { kind } = useOrgInfoSource();
  return <SummaryDetailPage id={id} scope={kind === 'agency' ? 'agency' : 'landlord'} />;
}

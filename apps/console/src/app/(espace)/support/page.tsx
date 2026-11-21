import { ConsoleSupportBoardPage, SupportBoardPage } from '@eguardimmo/messagerie';
import type { Metadata } from 'next';
import { dataSource } from '@/lib/env';

export const metadata: Metadata = { title: 'Support' };

export default function Page() {
  return dataSource === 'api' ? <ConsoleSupportBoardPage /> : <SupportBoardPage />;
}

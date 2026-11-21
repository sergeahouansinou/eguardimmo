import type { Metadata } from 'next';
import { AuditScreen } from '@/features/audit/AuditScreen';
import { ActivityScreen } from '@/features/audit/ActivityScreen';
import { dataSource } from '@/lib/env';

export const metadata: Metadata = { title: "Journal d'audit" };

export default function Page() {
  return dataSource === 'api' ? <ActivityScreen /> : <AuditScreen />;
}

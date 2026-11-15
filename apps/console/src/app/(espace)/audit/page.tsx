import type { Metadata } from 'next';
import { AuditScreen } from '@/features/audit/AuditScreen';

export const metadata: Metadata = { title: "Journal d'audit" };

export default function Page() {
  return <AuditScreen />;
}

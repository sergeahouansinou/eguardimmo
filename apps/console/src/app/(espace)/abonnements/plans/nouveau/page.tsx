import type { Metadata } from 'next';
import { PlanFormScreen } from '@/features/abonnements/PlanFormScreen';

export const metadata: Metadata = { title: 'Nouveau plan' };

export default function Page() {
  return <PlanFormScreen />;
}

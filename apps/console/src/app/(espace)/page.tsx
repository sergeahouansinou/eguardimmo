import type { Metadata } from 'next';
import { OverviewScreen } from '@/features/overview/OverviewScreen';

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default function Page() {
  return <OverviewScreen />;
}

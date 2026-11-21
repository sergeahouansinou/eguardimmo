import type { Metadata } from 'next';
import { OverviewScreen } from '@/features/overview/OverviewScreen';
import { dataSource } from '@/lib/env';
import { AccueilScreen } from '@/screens/accueil/AccueilScreen';

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default function Page() {
  return dataSource === 'api' ? <AccueilScreen /> : <OverviewScreen />;
}

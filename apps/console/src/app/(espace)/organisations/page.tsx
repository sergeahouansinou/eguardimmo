import type { Metadata } from 'next';
import { OrganisationsScreen } from '@/features/organisations/OrganisationsScreen';

export const metadata: Metadata = { title: 'Organisations' };

export default function Page() {
  return <OrganisationsScreen />;
}

import type { Metadata } from 'next';
import { OrganisationsScreen as DemoOrganisationsScreen } from '@/features/organisations/OrganisationsScreen';
import { dataSource } from '@/lib/env';
import { OrganisationsScreen } from '@/screens/organisations/OrganisationsScreen';

export const metadata: Metadata = { title: 'Organisations' };

export default function Page() {
  return dataSource === 'api' ? <OrganisationsScreen /> : <DemoOrganisationsScreen />;
}

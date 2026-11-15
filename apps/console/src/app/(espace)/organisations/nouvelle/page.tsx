import type { Metadata } from 'next';
import { OrganisationFormScreen } from '@/features/organisations/OrganisationFormScreen';

export const metadata: Metadata = { title: 'Nouvelle organisation' };

export default function Page() {
  return <OrganisationFormScreen />;
}

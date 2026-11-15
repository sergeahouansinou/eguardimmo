import { HelpPage } from '@eguardimmo/messagerie';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Centre d’aide' };

export default function Page() {
  return <HelpPage />;
}

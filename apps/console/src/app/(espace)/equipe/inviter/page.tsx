import type { Metadata } from 'next';
import { InviteScreen } from '@/features/equipe/InviteScreen';

export const metadata: Metadata = { title: 'Inviter un opérateur' };

export default function Page() {
  return <InviteScreen />;
}

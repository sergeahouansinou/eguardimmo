import type { ReactNode } from 'react';
import { SettingsLayout } from '@/features/parametres/SettingsLayout';

export default function ParametresLayout({ children }: { children: ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}

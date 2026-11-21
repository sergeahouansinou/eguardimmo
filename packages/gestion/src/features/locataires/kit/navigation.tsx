'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { LinkComponent } from '@eguardimmo/ui';

export interface WriteToTenantTarget {
  partyId: string;
  partyName: string;
  leases: readonly { id: string; label: string }[];
  defaultLeaseId?: string;
}

export interface GestionNavigation {
  Link: LinkComponent;
  push: (href: string) => void;
  search: URLSearchParams;
  writeToTenant?: (target: WriteToTenantTarget) => ReactNode;
}

const NavigationContext = createContext<GestionNavigation | null>(null);

export function GestionNavigationProvider({ value, children }: { value: GestionNavigation; children: ReactNode }) {
  return <NavigationContext value={value}>{children}</NavigationContext>;
}

export function useGestionNavigation(): GestionNavigation {
  const navigation = use(NavigationContext);
  if (!navigation) throw new Error('GestionNavigationProvider manquant autour de l’écran.');
  return navigation;
}

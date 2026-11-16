'use client';

import { OrganizationGate } from '@eguardimmo/shell';
import type { OrganizationGateProps } from '@eguardimmo/shell';
import { CourriersSourceProvider, createUnavailableCourriersSource } from '../features/courriers';
import { GestionDataModeProvider } from '../features/locataires';
import { BauxApiProvider } from './BauxApiProvider';
import { EquipeApiProvider } from './EquipeApiProvider';
import { LocatairesApiProvider } from './LocatairesApiProvider';
import { ShellApiProvider } from './ShellApiProvider';

const unavailableCourriers = createUnavailableCourriersSource();

export function GestionApiData({ children, ...gate }: OrganizationGateProps) {
  return (
    <GestionDataModeProvider mode="api">
      <OrganizationGate {...gate}>
        <ShellApiProvider>
          <EquipeApiProvider>
            <LocatairesApiProvider>
              <BauxApiProvider>
                <CourriersSourceProvider source={unavailableCourriers}>{children}</CourriersSourceProvider>
              </BauxApiProvider>
            </LocatairesApiProvider>
          </EquipeApiProvider>
        </ShellApiProvider>
      </OrganizationGate>
    </GestionDataModeProvider>
  );
}

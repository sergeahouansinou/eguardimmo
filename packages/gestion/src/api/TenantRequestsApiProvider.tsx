'use client';

import { useOrganizationSession } from '@eguardimmo/shell';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  ContactUpdatesSourceProvider,
  InspectionsSourceProvider,
  InsuranceSourceProvider,
  LeaseLookupProvider,
  NoticesSourceProvider,
  OnlinePaymentsSourceProvider,
  TenantRequestsAccessProvider,
  createApiContactUpdatesSource,
  createApiInspectionsSource,
  createApiInsuranceSource,
  createApiLeaseLookup,
  createApiNoticesSource,
  createApiOnlinePaymentsSource,
  tenantRequestsPermissions,
} from '../features/tenantRequests';

export function TenantRequestsApiProvider({ children }: { children: ReactNode }) {
  const session = useOrganizationSession();
  const sources = useMemo(() => {
    if (!session) return null;
    const options = { client: session.client, organizationId: session.organization.organization };
    return {
      permissions: tenantRequestsPermissions(session.organization.role),
      lookup: createApiLeaseLookup(session.client, session.organization.organization),
      notices: createApiNoticesSource(options),
      insurance: createApiInsuranceSource(options),
      inspections: createApiInspectionsSource(options),
      payments: createApiOnlinePaymentsSource(options),
      contacts: createApiContactUpdatesSource(options),
    };
  }, [session]);
  if (!sources) throw new Error('TenantRequestsApiProvider exige une session d’organisation ouverte par OrganizationGate.');
  return (
    <TenantRequestsAccessProvider source={sources.permissions}>
      <LeaseLookupProvider source={sources.lookup}>
        <NoticesSourceProvider source={sources.notices}>
          <InsuranceSourceProvider source={sources.insurance}>
            <InspectionsSourceProvider source={sources.inspections}>
              <OnlinePaymentsSourceProvider source={sources.payments}>
                <ContactUpdatesSourceProvider source={sources.contacts}>{children}</ContactUpdatesSourceProvider>
              </OnlinePaymentsSourceProvider>
            </InspectionsSourceProvider>
          </InsuranceSourceProvider>
        </NoticesSourceProvider>
      </LeaseLookupProvider>
    </TenantRequestsAccessProvider>
  );
}

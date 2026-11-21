'use client';

import { OrganizationGate } from '@eguardimmo/shell';
import type { OrganizationGateProps } from '@eguardimmo/shell';
import { CourriersSourceProvider, createUnavailableCourriersSource } from '../features/courriers';
import { GestionDataModeProvider } from '../features/locataires';
import { ActivityApiProvider } from './ActivityApiProvider';
import { AnalyticsApiProvider } from './AnalyticsApiProvider';
import { BankingApiProvider } from './BankingApiProvider';
import { BauxApiProvider } from './BauxApiProvider';
import { ChargesApiProvider } from './ChargesApiProvider';
import { ConformiteApiProvider } from './ConformiteApiProvider';
import { DirectoryApiProvider } from './DirectoryApiProvider';
import { EquipeApiProvider } from './EquipeApiProvider';
import { InvestmentsApiProvider } from './InvestmentsApiProvider';
import { InvoicingApiProvider } from './InvoicingApiProvider';
import { LegalIdentityApiProvider } from './LegalIdentityApiProvider';
import { LocatairesApiProvider } from './LocatairesApiProvider';
import { MaintenanceApiProvider } from './MaintenanceApiProvider';
import { OrgApiProvider } from './OrgApiProvider';
import { OwnerFundsApiProvider } from './OwnerFundsApiProvider';
import { PlanningApiProvider } from './PlanningApiProvider';
import { RecoveryApiProvider } from './RecoveryApiProvider';
import { RentApiProvider } from './RentApiProvider';
import { ReportingApiProvider } from './ReportingApiProvider';
import { ShellApiProvider } from './ShellApiProvider';
import { TaxApiProvider } from './TaxApiProvider';
import { TenantAccessApiProvider } from './TenantAccessApiProvider';
import { TenantRequestsApiProvider } from './TenantRequestsApiProvider';

const unavailableCourriers = createUnavailableCourriersSource();

export function GestionApiData({ children, ...gate }: OrganizationGateProps) {
  return (
    <GestionDataModeProvider mode="api">
      <OrganizationGate {...gate}>
        <ShellApiProvider>
          <EquipeApiProvider>
            <LocatairesApiProvider>
              <BauxApiProvider>
                <RentApiProvider>
                  <RecoveryApiProvider>
                    <InvoicingApiProvider>
                      <ConformiteApiProvider>
                        <MaintenanceApiProvider>
                          <OwnerFundsApiProvider>
                            <ChargesApiProvider>
                              <BankingApiProvider>
                                <ReportingApiProvider>
                                  <TenantAccessApiProvider>
                                    <LegalIdentityApiProvider>
                                      <TenantRequestsApiProvider>
                                        <OrgApiProvider>
                                          <PlanningApiProvider>
                                            <DirectoryApiProvider>
                                              <ActivityApiProvider>
                                                <InvestmentsApiProvider>
                                                  <TaxApiProvider>
                                                    <AnalyticsApiProvider>
                                                      <CourriersSourceProvider source={unavailableCourriers}>{children}</CourriersSourceProvider>
                                                    </AnalyticsApiProvider>
                                                  </TaxApiProvider>
                                                </InvestmentsApiProvider>
                                              </ActivityApiProvider>
                                            </DirectoryApiProvider>
                                          </PlanningApiProvider>
                                        </OrgApiProvider>
                                      </TenantRequestsApiProvider>
                                    </LegalIdentityApiProvider>
                                  </TenantAccessApiProvider>
                                </ReportingApiProvider>
                              </BankingApiProvider>
                            </ChargesApiProvider>
                          </OwnerFundsApiProvider>
                        </MaintenanceApiProvider>
                      </ConformiteApiProvider>
                    </InvoicingApiProvider>
                  </RecoveryApiProvider>
                </RentApiProvider>
              </BauxApiProvider>
            </LocatairesApiProvider>
          </EquipeApiProvider>
        </ShellApiProvider>
      </OrganizationGate>
    </GestionDataModeProvider>
  );
}

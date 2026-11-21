'use client';

import { Alert, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/ui/PageHeader';
import { usePlans } from './hooks';
import { PlansPanel } from './PlansPanel';
import { SubscriptionsPanel } from './SubscriptionsPanel';

export function AbonnementsScreen() {
  const plans = usePlans();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Abonnements"
        subtitle="Catalogue des plans versionnés et abonnements des organisations."
      />
      <Alert tone="info" title="Facturation et encaissement : bientôt disponible">
        Aucun encaissement n’est encore branché : les revenus récurrents ne sont pas calculés et aucun montant n’est affiché. La facturation de la plateforme fera l’objet d’une décision distincte.
      </Alert>
      <Tabs defaultValue="plans">
        <TabList aria-label="Sections des abonnements">
          <Tab value="plans">Plans</Tab>
          <Tab value="abonnements">Abonnements</Tab>
        </TabList>
        <TabPanel value="plans" className="pt-2">
          <PlansPanel query={plans} />
        </TabPanel>
        <TabPanel value="abonnements" className="pt-2">
          <SubscriptionsPanel planCodes={plans.data?.map((plan) => plan.code) ?? []} />
        </TabPanel>
      </Tabs>
    </div>
  );
}

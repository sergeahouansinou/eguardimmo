'use client';

import { Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import Link from 'next/link';
import { PageHeader } from '@/ui/PageHeader';
import { NotificationTypesPanel } from './NotificationTypesPanel';
import { RemindersPanel } from './RemindersPanel';

export function RappelsScreen() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Notifications et rappels"
        subtitle="Réglages de la plateforme, valables pour tous les comptes."
        breadcrumb={[{ label: 'Vue d’ensemble', href: '/' }, { label: 'Notifications et rappels' }]}
      />
      <Tabs defaultValue="rappels">
        <TabList aria-label="Sections des notifications">
          <Tab value="rappels">Rappels automatiques</Tab>
          <Tab value="notifications">Notifications</Tab>
        </TabList>
        <TabPanel value="rappels" keepMounted className="pt-2">
          <RemindersPanel />
        </TabPanel>
        <TabPanel value="notifications" keepMounted className="pt-2">
          <NotificationTypesPanel />
        </TabPanel>
      </Tabs>
    </div>
  );
}

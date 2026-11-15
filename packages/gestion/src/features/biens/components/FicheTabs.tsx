'use client';

import { Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { useBiensEnvironment } from '../environment';

export interface FicheTab {
  id: string;
  label: string;
}

const OVERVIEW = 'apercu';

export interface FicheTabsProps {
  label: string;
  basePath: string;
  tabs: readonly FicheTab[];
  counts?: Partial<Record<string, number>>;
  children: ReactNode;
}

export function FicheTabs({ label, basePath, tabs, counts, children }: FicheTabsProps) {
  const { pathname, push } = useBiensEnvironment();
  const path = pathname.replace(/\/$/, '');
  const current =
    tabs.find((tab) => tab.id !== '' && path === `${basePath}/${tab.id}`)?.id ?? (path === basePath ? '' : undefined);
  const value = current === '' ? OVERVIEW : (current ?? OVERVIEW);
  return (
    <Tabs value={value} defaultValue={OVERVIEW} onValueChange={(next) => {
      const tab = tabs.find((entry) => (entry.id === '' ? OVERVIEW : entry.id) === next);
      if (tab) push(tab.id === '' ? basePath : `${basePath}/${tab.id}`);
    }}>
      <TabList aria-label={label}>
        {tabs.map((tab) => (
          <Tab key={tab.id} value={tab.id === '' ? OVERVIEW : tab.id} count={counts?.[tab.id]}>
            {tab.label}
          </Tab>
        ))}
      </TabList>
      <TabPanel value={value} className="flex flex-col gap-4 pt-2">
        {children}
      </TabPanel>
    </Tabs>
  );
}

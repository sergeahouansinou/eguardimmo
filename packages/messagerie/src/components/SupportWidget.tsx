'use client';

import { useState } from 'react';
import { Button, TabPanel, TextField } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { useHelpCenter, useSupportStatus } from '../data/queries';
import { ContactSupportForm } from './ContactSupportForm';
import { FaqAccordion, filterHelp } from './FaqAccordion';
import { MyTicketList, MyTicketThread } from './MyTickets';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './parts';
import { WidgetFrame } from './WidgetFrame';

type WidgetTab = 'aide' | 'demandes' | 'contact';

export function WidgetHelp({ onContact }: { onContact: () => void }) {
  const { profile, routes, Link } = useMessagerieConfig();
  const help = useHelpCenter();
  const [search, setSearch] = useState('');

  if (help.data === undefined) {
    return help.isError ? (
      <ErrorBlock message="Impossible de charger l’aide." onRetry={help.refetch} />
    ) : (
      <LoadingBlock label="Chargement de l’aide" />
    );
  }
  const categories = filterHelp(help.data.categories, search);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <TextField
        label="Rechercher dans l’aide"
        hideLabel
        type="search"
        placeholder={profile.help.searchPlaceholder}
        value={search}
        onChange={(event) => { setSearch(event.target.value); }}
      />
      {categories.length === 0 ? (
        <EmptyBlock title="Aucune réponse ne correspond" hint="Contactez le support pour poser votre question." />
      ) : (
        <FaqAccordion categories={categories} compact />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={routes.help} className="text-body font-medium text-action-on-subtle underline underline-offset-3">
          Ouvrir le centre d’aide
        </Link>
        <Button size="sm" onClick={onContact}>
          Contacter le support
        </Button>
      </div>
    </div>
  );
}

const TABS = [
  { value: 'aide', label: 'Aide' },
  { value: 'demandes', label: 'Mes demandes' },
  { value: 'contact', label: 'Contacter' },
] as const;

export function SupportWidget() {
  const { profile } = useMessagerieConfig();
  const status = useSupportStatus();
  const [tab, setTab] = useState<WidgetTab>('aide');
  const [ticketId, setTicketId] = useState<string | null>(null);

  if (!profile.help.supportTicket) return null;

  const handleTab = (value: string) => {
    if (value === 'aide' || value === 'demandes' || value === 'contact') setTab(value);
  };

  return (
    <WidgetFrame
      subtitle={status.data ? `${status.data.hoursLabel} · ${status.data.responseLabel}` : 'Chargement'}
      online={status.data ? status.data.online : null}
      tabs={TABS}
      tab={tab}
      onTabChange={handleTab}
    >
      <TabPanel value="aide">
        <WidgetHelp onContact={() => { setTab('contact'); }} />
      </TabPanel>
      <TabPanel value="demandes">
        {ticketId ? (
          <MyTicketThread ticketId={ticketId} onBack={() => { setTicketId(null); }} />
        ) : (
          <MyTicketList onOpen={setTicketId} onContact={() => { setTab('contact'); }} />
        )}
      </TabPanel>
      <TabPanel value="contact">
        <ContactSupportForm
          onCreated={(id) => {
            setTicketId(id);
            setTab('demandes');
          }}
        />
      </TabPanel>
    </WidgetFrame>
  );
}

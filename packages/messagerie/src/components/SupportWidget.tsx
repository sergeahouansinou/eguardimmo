'use client';

import { LifeBuoy, X } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  Icon,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Tooltip,
  cx,
} from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import { useHelpCenter, useSupportStatus } from '../data/queries';
import { ContactSupportForm } from './ContactSupportForm';
import { FaqAccordion, filterHelp } from './FaqAccordion';
import { MyTicketList, MyTicketThread } from './MyTickets';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './parts';

type WidgetTab = 'aide' | 'demandes' | 'contact';

function WidgetHelp({ onContact }: { onContact: () => void }) {
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

export function SupportWidget() {
  const { profile } = useMessagerieConfig();
  const status = useSupportStatus();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WidgetTab>('aide');
  const [ticketId, setTicketId] = useState<string | null>(null);

  if (!profile.help.supportTicket) return null;

  const handleTab = (value: string) => {
    if (value === 'aide' || value === 'demandes' || value === 'contact') setTab(value);
  };

  return (
    <div className="fixed right-4 bottom-[72px] z-40 md:bottom-4">
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip content="Aide et support" side="left">
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Aide et support"
              className="inline-flex size-12 items-center justify-center rounded-full bg-action text-on-action hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Icon icon={open ? X : LifeBuoy} size={20} />
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent
          aria-label="Aide et support"
          side="top"
          align="end"
          className="h-[min(600px,calc(100dvh-140px))] w-[400px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-block-title text-fg">Aide et support</span>
              <span className="text-caption text-fg-subtle">
                {status.data ? `${status.data.hoursLabel} · ${status.data.responseLabel}` : 'Chargement'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status.data ? (
                <Badge tone={status.data.online ? 'success' : 'neutral'}>{status.data.online ? 'En ligne' : 'Hors ligne'}</Badge>
              ) : null}
              <PopoverClose asChild>
                <Button variant="ghost" size="sm" aria-label="Fermer l’aide">
                  <Icon icon={X} />
                </Button>
              </PopoverClose>
            </div>
          </div>
          <Tabs value={tab} defaultValue={tab} onValueChange={handleTab} size="sm" className="min-h-0 flex-1 gap-0">
            <TabList aria-label="Rubriques de l’aide" className="px-2">
              <Tab value="aide">Aide</Tab>
              <Tab value="demandes">Mes demandes</Tab>
              <Tab value="contact">Contacter</Tab>
            </TabList>
            <div className={cx('min-h-0 flex-1 overflow-y-auto p-3')}>
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
            </div>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}

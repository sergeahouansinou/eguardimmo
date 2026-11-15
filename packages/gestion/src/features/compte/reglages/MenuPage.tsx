'use client';

import {
  BookUser,
  Building,
  Calendar,
  CalendarCheck,
  ChartColumn,
  ChartPie,
  FilePenLine,
  Folder,
  HandCoins,
  House,
  ListChecks,
  MessageSquare,
  UserRoundSearch,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Alert, Badge, Icon, Select } from '@eguardimmo/ui';
import { QueryState } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { FormAlerts } from '../shared/FormAlerts';
import { SettingRow, SettingsCard, controlWidth } from '../shared/SettingRow';
import { SettingsLayout } from '../shared/SettingsLayout';
import { Toggle } from '../shared/Toggle';
import { FINANCE_TABS, HOME_PAGES, MENU_GROUPS, TENANT_TABS, menuSchema } from './schemas';
import type { MenuGroup, MenuSettings } from './schemas';
import { financeTabOptions, homePageOptions, tenantTabOptions } from './options';
import { narrow } from '../shared/narrow';
import { useMenuSettings, useSaveMenu } from './source';
import { useSettingsForm } from '../shared/useSettingsForm';

const ICONS: Record<string, LucideIcon> = {
  accueil: House,
  biens: Building,
  locataires: Users,
  baux: FilePenLine,
  finances: Wallet,
  documents: Folder,
  messages: MessageSquare,
  interventions: Wrench,
  agenda: Calendar,
  taches: ListChecks,
  candidats: UserRoundSearch,
  analytique: ChartPie,
  rapports: ChartColumn,
  modeles: FilePenLine,
  contacts: BookUser,
  reservations: CalendarCheck,
  prets: HandCoins,
};

const GROUP_LABELS: Record<MenuGroup, string> = { principal: 'Principal', suivi: 'Suivi', outils: 'Outils' };

function ModuleGroup({ group, value, update }: { group: MenuGroup; value: MenuSettings; update: (patch: Partial<MenuSettings>) => void }) {
  const modules = value.modules.filter((entry) => entry.group === group);
  const shown = modules.filter((entry) => entry.visible).length;
  const id = `rm-${group}`;
  return (
    <SettingsCard id={id} title={GROUP_LABELS[group]} aside={<span className="text-caption text-fg-subtle">{`${String(shown)} sur ${String(modules.length)}`}</span>}>
      <ul>
        {modules.map((entry) => (
          <li key={entry.id} className="flex h-10 items-center gap-2 border-t border-line text-body text-fg first:border-t-0">
            <Icon icon={ICONS[entry.id] ?? House} className="text-fg-subtle" />
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            {entry.locked ? (
              <Badge>Toujours affiché</Badge>
            ) : (
              <Toggle
                label={`${entry.label} ${entry.visible ? 'affiché' : 'masqué'}`}
                checked={entry.visible}
                onCheckedChange={(visible) => {
                  update({ modules: value.modules.map((candidate) => (candidate.id === entry.id ? { ...candidate, visible } : candidate)) });
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

function MenuForm({ value, update }: { value: MenuSettings; update: (patch: Partial<MenuSettings>) => void }) {
  return (
    <>
      <SettingsCard id="rm-vue" title="Vues par défaut">
        <div>
          <SettingRow title="Page d'accueil" hint="Ouverte après la connexion">
            <Select
              label="Page d'accueil"
              hideLabel
              placeholder="Choisir"
              className={controlWidth}
              options={homePageOptions}
              value={value.homePage}
              onValueChange={(next) => {
                const homePage = narrow(HOME_PAGES, next);
                if (homePage) update({ homePage });
              }}
            />
          </SettingRow>
          <SettingRow title="Liste des locataires" hint="Onglet sélectionné à l'ouverture">
            <Select
              label="Liste des locataires"
              hideLabel
              placeholder="Choisir"
              className={controlWidth}
              options={tenantTabOptions}
              value={value.tenantsTab}
              onValueChange={(next) => {
                const tenantsTab = narrow(TENANT_TABS, next);
                if (tenantsTab) update({ tenantsTab });
              }}
            />
          </SettingRow>
          <SettingRow title="Finances" hint="Onglet sélectionné à l'ouverture">
            <Select
              label="Finances"
              hideLabel
              placeholder="Choisir"
              className={controlWidth}
              options={financeTabOptions}
              value={value.financesTab}
              onValueChange={(next) => {
                const financesTab = narrow(FINANCE_TABS, next);
                if (financesTab) update({ financesTab });
              }}
            />
          </SettingRow>
        </div>
      </SettingsCard>
      <Alert tone="info">Masquer une rubrique la retire du menu. Aucune donnée n'est supprimée.</Alert>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        {MENU_GROUPS.map((group) => (
          <ModuleGroup key={group} group={group} value={value} update={update} />
        ))}
      </div>
    </>
  );
}

export function ReglagesMenuPage({ Link }: ScreenProps) {
  const query = useMenuSettings();
  const save = useSaveMenu();
  const form = useSettingsForm({
    saved: query.data,
    schema: menuSchema,
    save: (value) => save.mutateAsync(value),
    success: 'Menu et rubriques enregistrés.',
  });
  return (
    <SettingsLayout
      Link={Link}
      section="menu"
      description="Choisissez les rubriques affichées dans le menu et la vue ouverte par défaut."
      onCancel={form.reset}
      onSave={form.submit}
      saving={form.saving}
    >
      <FormAlerts errors={form.errors} failed={form.failed} failureTitle="Les réglages n'ont pas pu être enregistrés" />
      <QueryState query={query} errorTitle="Les réglages n'ont pas pu être chargés" loadingLabel="Chargement des réglages">
        {() => (form.value ? <MenuForm value={form.value} update={form.update} /> : null)}
      </QueryState>
    </SettingsLayout>
  );
}

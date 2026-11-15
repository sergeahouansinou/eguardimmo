import { Bell, CircleUser, CreditCard, FileText, PanelLeft, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Icon, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { PageHeader } from '../../outils/kit';

export type SettingsSection = 'general' | 'documents' | 'menu' | 'notifications' | 'compte' | 'abonnement';

interface SectionDef {
  id: SettingsSection;
  label: string;
  href: string;
  icon: LucideIcon;
}

const PREFERENCES: readonly SectionDef[] = [
  { id: 'general', label: 'Général', href: '/reglages', icon: Settings },
  { id: 'documents', label: 'Documents et quittances', href: '/reglages/documents', icon: FileText },
  { id: 'menu', label: 'Menu et rubriques', href: '/reglages/menu', icon: PanelLeft },
  { id: 'notifications', label: 'Notifications', href: '/reglages/notifications', icon: Bell },
];

const ACCOUNT: readonly SectionDef[] = [
  { id: 'compte', label: 'Mon compte', href: '/compte', icon: CircleUser },
  { id: 'abonnement', label: 'Abonnement', href: '/compte/abonnement', icon: CreditCard },
];

function SectionLink({ Link, def, current }: { Link: LinkComponent; def: SectionDef; current: SettingsSection }) {
  const active = def.id === current;
  return (
    <Link
      href={def.href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-body whitespace-nowrap',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        active ? 'bg-action-subtle font-semibold text-action-on-subtle' : 'font-medium text-fg-muted hover:bg-muted',
      )}
    >
      <Icon icon={def.icon} className={active ? 'text-action-on-subtle' : 'text-fg-subtle'} />
      {def.label}
    </Link>
  );
}

export interface SettingsLayoutProps {
  Link: LinkComponent;
  section: SettingsSection;
  description: string;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  children: ReactNode;
}

export function SettingsLayout({ Link, section, description, onCancel, onSave, saving = false, children }: SettingsLayoutProps) {
  const all = [...PREFERENCES, ...ACCOUNT];
  const label = all.find((def) => def.id === section)?.label ?? '';
  const editable = onSave !== undefined;
  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Réglages', href: '/reglages' }, { label }]}
        title="Réglages"
        description={description}
        actions={
          editable ? (
            <>
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Annuler
              </Button>
              <Button onClick={onSave} loading={saving}>
                Enregistrer
              </Button>
            </>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[232px_minmax(0,1fr)]">
        <nav aria-label="Sections des réglages" className="relative flex gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface p-2 lg:flex-col lg:overflow-visible">
          {PREFERENCES.map((def) => (
            <SectionLink key={def.id} Link={Link} def={def} current={section} />
          ))}
          <div role="separator" className="mx-1 my-1 w-px bg-line lg:mx-0 lg:h-px lg:w-auto" />
          <span className="hidden px-2.5 pt-2 pb-1 text-caption font-medium text-fg-subtle lg:block">Compte</span>
          {ACCOUNT.map((def) => (
            <SectionLink key={def.id} Link={Link} def={def} current={section} />
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      </div>
    </>
  );
}

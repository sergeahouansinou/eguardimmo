import { ShieldCheck, ShieldHalf, UserCog, Wallet, Crown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { SettingsCard } from '../shared/SettingRow';
import { Toggle } from '../shared/Toggle';
import { ROLES, ROLE_LABELS, ROLE_SUMMARIES } from './schemas';
import type { Role } from './schemas';

const ROLE_ICONS: Record<Role, LucideIcon> = {
  titulaire: Crown,
  administrateur: ShieldHalf,
  gestionnaire: UserCog,
  comptable: Wallet,
};

export function RolesCard({ Link }: { Link: LinkComponent }) {
  return (
    <SettingsCard id="eq-r" title="Rôles" aside={
        <Link href="/equipe/roles" className="inline-flex min-h-6 items-center text-caption font-medium text-action-on-subtle underline">
          Voir les droits
        </Link>
      }>
      <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {ROLES.map((role) => (
          <li key={role} className="flex min-h-11 items-center gap-2 border-t border-line first:border-t-0 sm:nth-[2]:border-t-0">
            <Icon icon={ROLE_ICONS[role]} className="text-action-on-subtle" />
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-body font-medium text-fg">{ROLE_LABELS[role]}</b>
              <span className="text-caption text-fg-subtle">{ROLE_SUMMARIES[role]}</span>
            </span>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

export function SecurityCard({ required, pending, onChange }: { required: boolean; pending: boolean; onChange: (required: boolean) => void }) {
  return (
    <SettingsCard id="eq-s" title="Sécurité">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-body text-fg-muted">
          <Icon icon={ShieldCheck} className="text-fg-subtle" />
          Double authentification
        </span>
        <Toggle label="Double authentification exigée" checked={required} disabled={pending} onCheckedChange={onChange} />
      </div>
      <span className="text-caption text-fg-subtle">{required ? 'Exigée pour tous les membres.' : "Non exigée : chaque membre choisit d'activer la double authentification."}</span>
    </SettingsCard>
  );
}

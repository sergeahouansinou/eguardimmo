'use client';

import {
  ArrowLeftRight,
  CircleQuestionMark,
  CircleUser,
  CreditCard,
  Download,
  KeyRound,
  LogOut,
  ScrollText,
  Settings,
  SunMoon,
  UsersRound,
} from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import {
  Avatar,
  Badge,
  Icon,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSegmented,
  MenuSeparator,
  MenuTrigger,
} from '@eguardimmo/ui';
import type { ShellData } from '../data/schemas';
import { THEMES, useTheme } from '../lib/theme';
import type { ThemeChoice } from '../lib/theme';
import { accountRoutes } from '../navigation/routes';

const roleLabel: Record<ShellData['workspace']['role'], string> = {
  admin: 'Admin',
  gestionnaire: 'Gestionnaire',
  agent: 'Agent',
};

const themeOptions: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Auto' },
];

export interface AccountMenuProps {
  shell: ShellData;
  onNavigate: (href: string) => void;
}

export function AccountMenu({ shell, onNavigate }: AccountMenuProps) {
  const [theme, setTheme] = useTheme();
  const { user, workspace } = shell;
  const go = (href: string) => () => { onNavigate(href); };

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Compte, espace de travail ${workspace.name}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface pr-2 pl-1 text-body-strong text-fg-muted hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[state=open]:border-action"
      >
        <Avatar initials={user.initials} />
        <span className="hidden max-w-[180px] truncate md:inline">{workspace.name}</span>
        <Icon icon={ChevronDown} size={14} className="hidden text-fg-subtle md:block" />
      </MenuTrigger>
      <MenuContent width="md" className="rounded-lg">
        <div className="flex items-center gap-2.5 p-2">
          <Avatar initials={user.initials} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-body font-semibold text-fg">{user.fullName}</b>
            <span className="truncate text-caption font-normal text-fg-subtle">{user.email}</span>
          </div>
          <Badge tone="info">{roleLabel[workspace.role]}</Badge>
        </div>
        <MenuItem
          icon={ArrowLeftRight}
          onSelect={go(accountRoutes.profiles)}
          aria-label="Changer d'espace"
          className="mx-1 mb-1 h-10 w-auto border border-line bg-page"
        >
          <span className="flex flex-col">
            <b className="truncate text-[13px] leading-4 font-medium">{workspace.name}</b>
            <span className="truncate text-[11px] leading-[14px] text-fg-subtle">Espace de {workspace.ownerName}</span>
          </span>
        </MenuItem>
        <MenuSeparator />
        <MenuLabel>Mon compte</MenuLabel>
        <MenuItem icon={CircleUser} onSelect={go(accountRoutes.account)}>Mon compte</MenuItem>
        <MenuItem icon={KeyRound} onSelect={go(accountRoutes.security)}>Connexion et sécurité</MenuItem>
        <MenuItem icon={CreditCard} meta={workspace.plan} onSelect={go(accountRoutes.subscription)}>Abonnement</MenuItem>
        <MenuItem icon={Download} onSelect={go(accountRoutes.export)}>Exporter mes données</MenuItem>
        <MenuSeparator />
        <MenuLabel>Espace</MenuLabel>
        <MenuItem icon={Settings} onSelect={go(accountRoutes.settings)}>Réglages</MenuItem>
        <MenuItem icon={UsersRound} meta={`${String(workspace.members)} membres`} onSelect={go(accountRoutes.team)}>
          Équipe
        </MenuItem>
        <MenuItem icon={ScrollText} onSelect={go(accountRoutes.journal)}>Journal d&apos;activité</MenuItem>
        <MenuSeparator />
        <MenuSegmented
          label="Apparence"
          icon={SunMoon}
          value={theme}
          options={themeOptions}
          onValueChange={(value) => {
            const next = THEMES.find((candidate) => candidate === value);
            if (next) setTheme(next);
          }}
        />
        <MenuItem icon={CircleQuestionMark} onSelect={go(accountRoutes.help)}>Centre d&apos;aide</MenuItem>
        <MenuSeparator />
        <MenuItem icon={LogOut} tone="danger" onSelect={go(accountRoutes.signOut)}>Se déconnecter</MenuItem>
      </MenuContent>
    </Menu>
  );
}

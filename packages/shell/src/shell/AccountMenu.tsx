'use client';

import { ArrowLeftRight, ChevronDown, LogOut, SunMoon } from 'lucide-react';
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
import { Fragment } from 'react';
import type { AccountMenuConfig, AccountMenuItem } from '../config/types';
import type { ShellData } from '../data/schemas';
import { THEMES, useTheme } from '../lib/theme';
import type { ThemeChoice } from '../lib/theme';

const themeOptions: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Auto' },
];

export interface AccountMenuProps {
  shell: ShellData;
  config: AccountMenuConfig;
  onNavigate: (href: string) => void;
}

export function AccountMenu({ shell, config, onNavigate }: AccountMenuProps) {
  const [theme, setTheme] = useTheme();
  const { user, workspace } = shell;
  const go = (href: string) => () => { onNavigate(href); };
  const renderItem = (item: AccountMenuItem) => (
    <MenuItem key={item.id} icon={item.icon} meta={item.meta?.(shell)} onSelect={go(item.href)}>
      {item.label}
    </MenuItem>
  );

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
          <Badge tone="info">{config.roleLabels?.[workspace.role] ?? workspace.role}</Badge>
        </div>
        {config.switchSpace ? (
          <MenuItem
            icon={ArrowLeftRight}
            onSelect={go(config.switchSpace.href)}
            aria-label="Changer d'espace"
            className="mx-1 mb-1 h-10 w-auto border border-line bg-page"
          >
            <span className="flex flex-col">
              <b className="truncate text-[13px] leading-4 font-medium">{workspace.name}</b>
              <span className="truncate text-[11px] leading-[14px] text-fg-subtle">Espace de {workspace.ownerName}</span>
            </span>
          </MenuItem>
        ) : null}
        {config.groups.map((group) => (
          <Fragment key={group.id}>
            <MenuSeparator />
            <MenuLabel>{group.label}</MenuLabel>
            {group.items.map(renderItem)}
          </Fragment>
        ))}
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
        {config.footerItems?.map(renderItem)}
        <MenuSeparator />
        <MenuItem icon={LogOut} tone="danger" onSelect={go(config.signOut.href)}>Se déconnecter</MenuItem>
      </MenuContent>
    </Menu>
  );
}

'use client';

import { CircleQuestionMark, Menu as MenuIcon, PanelLeft, Plus, Search } from 'lucide-react';
import {
  Button,
  Icon,
  IconButton,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { Fragment } from 'react';
import type { ShellData } from '../data/schemas';
import { addMenu, helpMenu } from '../navigation/routes';
import { AccountMenu } from './AccountMenu';
import { NotificationsPanel } from './NotificationsPanel';

export interface TopBarProps {
  spaceLabel: string;
  logoSrc: string;
  shell: ShellData | undefined;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenSearch: () => void;
  onOpenMenu: () => void;
  onNavigate: (href: string) => void;
  Link: LinkComponent;
}

export function TopBar({
  spaceLabel,
  logoSrc,
  shell,
  collapsed,
  onToggleCollapsed,
  onOpenSearch,
  onOpenMenu,
  onNavigate,
  Link,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-3 md:gap-3 md:px-4">
      <span className="hidden md:contents">
        <IconButton
          label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
          icon={PanelLeft}
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
        />
      </span>
      <span className="contents md:hidden">
        <IconButton label="Ouvrir le menu" icon={MenuIcon} onClick={onOpenMenu} />
      </span>
      <Link href="/" aria-label="eGuardImmo, accueil" className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <img src={logoSrc} alt="" width={24} height={24} className="block size-6 rounded-full" />
      </Link>
      <span className="inline-flex min-h-7 max-w-[112px] shrink-0 items-center rounded-sm bg-action-subtle px-2 py-1 text-caption leading-[14px] font-semibold text-action-on-subtle md:ml-1 md:h-7 md:max-w-none md:px-2.5 md:text-[13px] md:leading-5 md:whitespace-nowrap">
        {spaceLabel}
      </span>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden h-8 w-[360px] min-w-0 items-center gap-1.5 overflow-hidden rounded-md border border-line-control bg-surface px-2.5 text-body text-fg-subtle hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:flex"
      >
        <Icon icon={Search} />
        <span className="flex-1 text-left">Rechercher</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-1 md:gap-2">
        <span className="contents lg:hidden">
          <IconButton label="Rechercher" icon={Search} onClick={onOpenSearch} />
        </span>
        <span className="hidden md:contents">
          <Menu>
            <MenuTrigger asChild>
              <Button>
                <Icon icon={Plus} />
                Ajouter
              </Button>
            </MenuTrigger>
            <MenuContent>
              {addMenu.map((group, index) => (
                <Fragment key={group.label}>
                  {index > 0 ? <MenuSeparator /> : null}
                  <MenuLabel>{group.label}</MenuLabel>
                  {group.items.map((item) => (
                    <MenuItem key={item.id} onSelect={() => { onNavigate(item.href); }}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Fragment>
              ))}
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Aide" icon={CircleQuestionMark} variant="secondary" />
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Aide</MenuLabel>
              {helpMenu.map((item, index) => (
                <Fragment key={item.id}>
                  {index === 3 ? <MenuSeparator /> : null}
                  <MenuItem meta={item.id === 'raccourcis' ? <Kbd>?</Kbd> : undefined} onSelect={() => { onNavigate(item.href); }}>
                    {item.label}
                  </MenuItem>
                </Fragment>
              ))}
            </MenuContent>
          </Menu>
        </span>
        {shell ? (
          <>
            <NotificationsPanel notifications={shell.notifications} Link={Link} onNavigate={onNavigate} />
            <AccountMenu shell={shell} onNavigate={onNavigate} />
          </>
        ) : (
          <span aria-hidden="true" className="h-8 w-16 animate-pulse rounded-md bg-muted md:w-[220px]" />
        )}
      </div>
    </header>
  );
}

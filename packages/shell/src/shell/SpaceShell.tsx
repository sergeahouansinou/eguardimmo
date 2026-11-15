'use client';

import { Ellipsis } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, BottomNav, SideNav } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { resolveNavigation } from '../config/types';
import type {
  AccountMenuConfig,
  AddMenuGroup,
  BottomItem,
  HelpMenuItem,
  NavigationSource,
  NotificationsConfig,
  PageResult,
} from '../config/types';
import { useShellData } from '../data/queries';
import { useStoredValue } from '../lib/storedValue';
import { CommandPalette } from './CommandPalette';
import { MoreSheet } from './MoreSheet';
import { TopBar } from './TopBar';

export interface SpaceShellProps {
  spaceLabel: string;
  logoSrc: string;
  currentPath: string;
  linkComponent: LinkComponent;
  onNavigate: (href: string) => void;
  railStorageKey: string;
  navigation: NavigationSource;
  bottomItems: BottomItem[];
  accountMenu: AccountMenuConfig;
  notifications: NotificationsConfig;
  searchPages: PageResult[];
  addMenu?: AddMenuGroup[];
  helpMenu?: HelpMenuItem[];
  searchPlaceholder?: string;
  searchNote?: string;
  children: ReactNode;
}

const NO_ADD_MENU: AddMenuGroup[] = [];
const NO_HELP_MENU: HelpMenuItem[] = [];

export function SpaceShell({
  spaceLabel,
  logoSrc,
  currentPath,
  linkComponent: Link,
  onNavigate,
  railStorageKey,
  navigation: navigationSource,
  bottomItems,
  accountMenu,
  notifications,
  searchPages,
  addMenu = NO_ADD_MENU,
  helpMenu = NO_HELP_MENU,
  searchPlaceholder = 'Rechercher une page',
  searchNote = 'La recherche porte sur les pages.',
  children,
}: SpaceShellProps) {
  const shell = useShellData();
  const [rail, setRail] = useStoredValue(railStorageKey, ['expanded', 'collapsed'] as const, 'expanded');
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigation = resolveNavigation(navigationSource, shell.data?.counts);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-page text-fg">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-body-strong focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <TopBar
        spaceLabel={spaceLabel}
        logoSrc={logoSrc}
        shell={shell.data}
        addMenu={addMenu}
        helpMenu={helpMenu}
        accountMenu={accountMenu}
        notifications={notifications}
        collapsed={rail === 'collapsed'}
        onToggleCollapsed={() => { setRail(rail === 'collapsed' ? 'expanded' : 'collapsed'); }}
        onOpenSearch={() => { setSearchOpen(true); }}
        onOpenMenu={() => { setMoreOpen(true); }}
        onNavigate={onNavigate}
        Link={Link}
      />
      <div className="flex min-h-0 flex-1">
        <div className="sticky top-14 hidden h-[calc(100dvh-56px)] shrink-0 md:flex">
          <SideNav
            label="Navigation principale"
            sections={navigation.sections}
            footer={navigation.footer}
            currentPath={currentPath}
            collapsed={rail === 'collapsed'}
            linkComponent={Link}
          />
        </div>
        <main id="contenu" tabIndex={-1} className="flex min-w-0 flex-1 flex-col gap-3 px-4 pt-4 pb-6 outline-none md:px-6">
          {shell.isError ? (
            <Alert tone="danger" title="Le compte n’a pas pu être chargé">
              Les compteurs et notifications sont indisponibles. Rechargez la page.
            </Alert>
          ) : null}
          {children}
        </main>
      </div>
      <BottomNav
        label="Navigation principale, mobile"
        currentPath={currentPath}
        linkComponent={Link}
        className="sticky bottom-0 z-30 md:hidden"
        items={[
          ...bottomItems,
          { id: 'plus', label: 'Plus', icon: Ellipsis, onSelect: () => { setMoreOpen(true); }, expanded: moreOpen },
        ]}
      />
      <CommandPalette
        pages={searchPages}
        placeholder={searchPlaceholder}
        note={searchNote}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={onNavigate}
      />
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        navigation={navigation}
        excluded={bottomItems.map((item) => item.id)}
        Link={Link}
      />
    </div>
  );
}

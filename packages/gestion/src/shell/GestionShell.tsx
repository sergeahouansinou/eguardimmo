'use client';

import { SpaceShell } from '@eguardimmo/shell';
import type { ShellCounts } from '@eguardimmo/shell';
import type { LinkComponent } from '@eguardimmo/ui';
import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { TIMEZONE_HREF, addMenu, buildNavigation, helpMenu, supportSearchPages } from '../navigation/routes';
import type { SupportNavigation } from '../navigation/routes';
import {
  SEARCH_NOTE,
  SEARCH_PLACEHOLDER,
  accountMenu as buildAccountMenu,
  bottomItems,
  notifications,
  searchPages,
} from './bailleurConfig';

const pages = searchPages();

const SHORTCUTS_HREF = '/aide/raccourcis';
const TEXT_FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || TEXT_FIELDS.has(target.tagName));
}

export interface GestionShellProps {
  spaceLabel: string;
  logoSrc: string;
  currentPath: string;
  linkComponent: LinkComponent;
  onNavigate: (href: string) => void;
  unreadMessages?: number;
  rent?: boolean;
  compliance?: boolean;
  tax?: boolean;
  support?: SupportNavigation;
  timezone?: boolean;
  children: ReactNode;
}

export function GestionShell({ children, unreadMessages, rent = false, compliance = rent, tax = rent, support, timezone = false, ...props }: GestionShellProps) {
  const { onNavigate } = props;
  const accountMenu = useMemo(() => buildAccountMenu(), []);
  const navigation = useMemo(
    () => (counts: ShellCounts | undefined) =>
      buildNavigation(unreadMessages === undefined ? counts : { ...counts, unreadMessages }, { rent, compliance, tax, timezone, ...(support ? { support } : {}) }),
    [unreadMessages, rent, compliance, tax, support, timezone],
  );
  const searchable = useMemo(
    () => [...pages, ...(support ? supportSearchPages : []), ...(timezone ? [{ href: TIMEZONE_HREF, label: 'Réglages, fuseau horaire de l’organisation' }] : [])],
    [support, timezone],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      onNavigate(SHORTCUTS_HREF);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); };
  }, [onNavigate]);

  return (
    <SpaceShell
      {...props}
      railStorageKey="eg-nav"
      navigation={navigation}
      bottomItems={bottomItems}
      addMenu={addMenu}
      helpMenu={helpMenu}
      accountMenu={accountMenu}
      notifications={notifications}
      searchPages={searchable}
      searchPlaceholder={SEARCH_PLACEHOLDER}
      searchNote={SEARCH_NOTE}
    >
      {children}
    </SpaceShell>
  );
}

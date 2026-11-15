'use client';

import { SpaceShell } from '@eguardimmo/shell';
import type { LinkComponent } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { addMenu, buildNavigation, helpMenu } from '../navigation/routes';
import {
  SEARCH_NOTE,
  SEARCH_PLACEHOLDER,
  accountMenu,
  bottomItems,
  notifications,
  searchPages,
} from './bailleurConfig';

const pages = searchPages();

export interface GestionShellProps {
  spaceLabel: string;
  logoSrc: string;
  currentPath: string;
  linkComponent: LinkComponent;
  onNavigate: (href: string) => void;
  children: ReactNode;
}

export function GestionShell({ children, ...props }: GestionShellProps) {
  return (
    <SpaceShell
      {...props}
      railStorageKey="eg-nav"
      navigation={buildNavigation}
      bottomItems={bottomItems}
      addMenu={addMenu}
      helpMenu={helpMenu}
      accountMenu={accountMenu}
      notifications={notifications}
      searchPages={pages}
      searchPlaceholder={SEARCH_PLACEHOLDER}
      searchNote={SEARCH_NOTE}
    >
      {children}
    </SpaceShell>
  );
}

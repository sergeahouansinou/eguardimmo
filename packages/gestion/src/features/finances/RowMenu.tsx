'use client';

import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton, Menu, MenuContent, MenuTrigger } from '@eguardimmo/ui';

export function RowMenu({ label = 'Plus d’actions', children }: { label?: string; children: ReactNode }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={label} icon={Ellipsis} aria-haspopup="menu" />
      </MenuTrigger>
      <MenuContent width="md" aria-label="Actions de la ligne">
        {children}
      </MenuContent>
    </Menu>
  );
}

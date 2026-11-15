'use client';

import { Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment } from 'react';
import { IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@eguardimmo/ui';

export interface ActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export function ActionMenu({ label, items }: { label: string; items: readonly ActionItem[] }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={label} icon={Ellipsis} />
      </MenuTrigger>
      <MenuContent>
        {items.map((item) => (
          <Fragment key={item.id}>
            {item.separatorBefore ? <MenuSeparator /> : null}
            <MenuItem icon={item.icon} tone={item.tone} disabled={item.disabled} onSelect={item.onSelect}>
              {item.label}
            </MenuItem>
          </Fragment>
        ))}
      </MenuContent>
    </Menu>
  );
}

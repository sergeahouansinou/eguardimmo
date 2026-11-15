'use client';

import { Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, IconButton, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@eguardimmo/ui';
import { Fragment } from 'react';
import { useBiensEnvironment } from '../environment';

export interface ActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
  separatorBefore?: boolean;
  disabled?: boolean;
}

export interface RowActionsProps {
  name: string;
  primary?: { label: string; href: string };
  items: readonly ActionItem[];
}

export function RowActions({ name, primary, items }: RowActionsProps) {
  const { Link, push } = useBiensEnvironment();
  return (
    <div className="flex items-center justify-end gap-1">
      {primary ? (
        <Button variant="secondary" size="sm" asChild>
          <Link href={primary.href} aria-label={`${primary.label}, ${name}`}>
            {primary.label}
          </Link>
        </Button>
      ) : null}
      {items.length > 0 ? (
        <Menu>
          <MenuTrigger asChild>
            <IconButton label={`Autres actions, ${name}`} icon={Ellipsis} aria-haspopup="menu" />
          </MenuTrigger>
          <MenuContent width="md" aria-label={`Actions, ${name}`}>
            {items.map((item) => (
              <Fragment key={item.id}>
                {item.separatorBefore ? <MenuSeparator /> : null}
                <MenuItem
                  icon={item.icon}
                  tone={item.tone}
                  disabled={item.disabled}
                  onSelect={() => {
                    if (item.href) push(item.href);
                    item.onSelect?.();
                  }}
                >
                  {item.label}
                </MenuItem>
              </Fragment>
            ))}
          </MenuContent>
        </Menu>
      ) : null}
    </div>
  );
}

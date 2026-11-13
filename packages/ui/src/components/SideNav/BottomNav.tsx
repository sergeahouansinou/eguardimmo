'use client';

import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';
import { Anchor } from './Anchor';
import type { LinkComponent } from './types';
import { isActiveHref } from './types';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  expanded?: boolean;
}

export interface BottomNavProps {
  label: string;
  items: BottomNavItem[];
  currentPath: string;
  linkComponent?: LinkComponent;
  className?: string;
}

const tab = cx(
  'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-caption',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-active',
);

export function BottomNav({
  label,
  items,
  currentPath,
  linkComponent: Link = Anchor,
  className,
}: BottomNavProps) {
  return (
    <nav aria-label={label} className={cx('flex h-[72px] shrink-0 items-stretch justify-around bg-nav px-1 pt-1.5 pb-3', className)}>
      {items.map((item) => {
        const active = item.href ? isActiveHref(item.href, currentPath) : item.expanded === true;
        const content = (
          <>
            <span className={cx('flex h-7 w-12 items-center justify-center rounded-full', active && 'bg-nav-active-bg')}>
              <Icon icon={item.icon} size={20} />
            </span>
            {item.label}
          </>
        );
        const tone = active ? 'text-nav-active' : 'text-nav-muted';
        return item.href ? (
          <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined} className={cx(tab, tone)}>
            {content}
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={item.expanded === true}
            onClick={item.onSelect}
            className={cx(tab, tone)}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}

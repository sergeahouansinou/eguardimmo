'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover/Popover';
import { Tooltip } from '../Tooltip/Tooltip';
import { activeChildHref, isEntryActive } from './types';
import { Anchor } from './Anchor';
import type { LinkComponent, NavEntry, NavSection } from './types';

const navFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nav-active';

const itemBase = cx(
  'relative flex h-[34px] w-full items-center gap-2.5 rounded-md pr-2 pl-2.5 text-body-strong whitespace-nowrap',
  navFocus,
);

const activeBar =
  "before:absolute before:top-2 before:bottom-2 before:-left-2 before:w-[3px] before:rounded-r-[3px] before:bg-nav-active before:content-['']";

export interface SideNavProps {
  label: string;
  sections: NavSection[];
  footer?: NavEntry[];
  currentPath: string;
  collapsed?: boolean;
  linkComponent?: LinkComponent;
  className?: string;
}

export function SideNav({
  label,
  sections,
  footer = [],
  currentPath,
  collapsed = false,
  linkComponent: Link = Anchor,
  className,
}: SideNavProps) {
  if (collapsed) {
    return (
      <nav
        aria-label={label}
        className={cx('flex w-[72px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto bg-nav py-3', className)}
      >
        {sections.map((section, index) => (
          <ul key={section.id} aria-label={section.label} className="flex w-full flex-col items-center gap-0.5">
            {index > 0 ? <li aria-hidden="true" className="my-2 h-px w-8 bg-nav-fg/15" /> : null}
            {section.entries.map((entry) => (
              <li key={entry.id}>
                <RailEntry entry={entry} currentPath={currentPath} Link={Link} />
              </li>
            ))}
          </ul>
        ))}
        {footer.length > 0 ? (
          <ul className="mt-auto flex w-full flex-col items-center gap-0.5 border-t border-nav-fg/15 pt-2">
            {footer.map((entry) => (
              <li key={entry.id}>
                <RailEntry entry={entry} currentPath={currentPath} Link={Link} />
              </li>
            ))}
          </ul>
        ) : null}
      </nav>
    );
  }

  return (
    <nav
      aria-label={label}
      className={cx('flex w-[232px] shrink-0 flex-col gap-3.5 overflow-y-auto bg-nav px-2 py-3 text-nav-fg', className)}
    >
      {sections.map((section) => (
        <NavGroup key={section.id} section={section} currentPath={currentPath} Link={Link} />
      ))}
      {footer.length > 0 ? (
        <ul className="mt-auto flex flex-col gap-0.5">
          {footer.map((entry) => (
            <li key={entry.id}>
              <ExpandedEntry entry={entry} currentPath={currentPath} Link={Link} />
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

interface EntryProps {
  entry: NavEntry;
  currentPath: string;
  Link: LinkComponent;
}

function NavGroup({ section, currentPath, Link }: { section: NavSection; currentPath: string; Link: LinkComponent }) {
  const [open, setOpen] = useState(true);
  const listId = `nav-${section.id}`;
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => { setOpen((value) => !value); }}
        className={cx(
          'flex min-h-6 w-full items-center justify-between pt-0.5 pr-2 pb-1 pl-2.5 text-left text-[11px] leading-4 font-semibold tracking-[0.06em] text-nav-muted uppercase',
          navFocus,
        )}
      >
        {section.label}
        <Icon icon={open ? ChevronDown : ChevronRight} size={14} />
      </button>
      {open ? (
        <ul id={listId} className="flex flex-col gap-0.5">
          {section.entries.map((entry) => (
            <li key={entry.id}>
              <ExpandedEntry entry={entry} currentPath={currentPath} Link={Link} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CountPill({ value }: { value: number }) {
  return (
    <span className="h-[18px] min-w-5 rounded-full bg-accent px-1.5 text-center text-caption leading-[18px] font-semibold text-on-accent">
      {value}
    </span>
  );
}

function ExpandedEntry({ entry, currentPath, Link }: EntryProps) {
  const active = isEntryActive(entry, currentPath);
  const [open, setOpen] = useState(active);
  const children = entry.children ?? [];
  const activeChild = activeChildHref(children, currentPath);

  if (children.length === 0) {
    return (
      <Link
        href={entry.href}
        aria-current={active ? 'page' : undefined}
        className={cx(
          itemBase,
          active ? cx('bg-nav-active-bg text-nav-active', activeBar) : 'text-nav-fg hover:bg-nav-fg/10',
        )}
      >
        <Icon icon={entry.icon} className={cx('size-[18px]', active ? 'text-nav-active' : 'text-nav-muted')} />
        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
        {entry.count ? <CountPill value={entry.count} /> : null}
      </Link>
    );
  }

  const subId = `nav-sub-${entry.id}`;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={subId}
        onClick={() => { setOpen((value) => !value); }}
        className={cx(itemBase, active ? 'font-semibold text-nav-fg' : 'text-nav-fg hover:bg-nav-fg/10')}
      >
        <Icon icon={entry.icon} className={cx('size-[18px]', active ? 'text-nav-active' : 'text-nav-muted')} />
        <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>
        {entry.count ? <CountPill value={entry.count} /> : null}
        <Icon icon={open ? ChevronDown : ChevronRight} size={14} className="text-nav-muted" />
      </button>
      {open ? (
        <ul id={subId} className="mt-0.5 mb-1.5 ml-[18px] flex flex-col gap-px border-l border-nav-fg/15 pl-2.5">
          {children.map((child) => {
            const childActive = child.href === activeChild;
            return (
              <li key={child.id}>
                <Link
                  href={child.href}
                  aria-current={childActive ? 'page' : undefined}
                  className={cx(
                    'relative flex h-[30px] items-center rounded-sm px-2 text-[13px] leading-5 font-medium whitespace-nowrap',
                    navFocus,
                    childActive
                      ? "bg-nav-active-bg text-nav-active before:absolute before:top-[7px] before:bottom-[7px] before:-left-[11px] before:w-0.5 before:rounded-xs before:bg-nav-active before:content-['']"
                      : 'text-nav-fg/80 hover:bg-nav-fg/10',
                  )}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}

const railItem = cx('relative flex size-11 items-center justify-center rounded-[10px]', navFocus);

function RailBadge({ value }: { value: number }) {
  return (
    <span className="absolute top-1 right-0.5 h-4 min-w-4 translate-x-1/4 -translate-y-1/4 rounded-full border-2 border-nav bg-accent px-1 text-center text-[10px] leading-3 font-bold text-on-accent box-content">
      {value}
    </span>
  );
}

function RailEntry({ entry, currentPath, Link }: EntryProps) {
  const active = isEntryActive(entry, currentPath);
  const tone = active
    ? "bg-nav-active-bg text-nav-active before:absolute before:top-3 before:bottom-3 before:-left-3.5 before:w-[3px] before:rounded-r-[3px] before:bg-nav-active before:content-['']"
    : 'text-nav-muted hover:bg-nav-fg/10 hover:text-nav-fg';
  const children = entry.children ?? [];
  const activeChild = activeChildHref(children, currentPath);

  if (children.length === 0) {
    return (
      <Tooltip content={entry.label} side="right">
        <Link href={entry.href} aria-label={entry.label} aria-current={active ? 'page' : undefined} className={cx(railItem, tone)}>
          <Icon icon={entry.icon} size={20} />
          {entry.count ? <RailBadge value={entry.count} /> : null}
        </Link>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger aria-label={entry.label} className={cx(railItem, tone)}>
        <Icon icon={entry.icon} size={20} />
        {entry.count ? <RailBadge value={entry.count} /> : null}
        <span aria-hidden="true" className="absolute right-[5px] bottom-[5px] size-0 border-4 border-transparent border-r-current border-b-current opacity-55" />
      </PopoverTrigger>
      <PopoverContent
        aria-label={entry.label}
        side="right"
        align="start"
        className="w-[168px] gap-px border-nav-fg/15 bg-nav p-1.5"
      >
        <span className="px-2 pt-1 pb-1.5 text-[11px] leading-4 font-semibold tracking-[0.06em] text-nav-muted uppercase">
          {entry.label}
        </span>
        {children.map((child) => {
          const childActive = child.href === activeChild;
          return (
            <Link
              key={child.id}
              href={child.href}
              aria-current={childActive ? 'page' : undefined}
              className={cx(
                'flex h-[30px] items-center rounded-sm px-2 text-[13px] leading-5 font-medium whitespace-nowrap',
                navFocus,
                childActive ? 'bg-nav-active-bg text-nav-active' : 'text-nav-fg hover:bg-nav-fg/10',
              )}
            >
              {child.label}
            </Link>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

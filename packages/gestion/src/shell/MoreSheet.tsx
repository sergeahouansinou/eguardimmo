'use client';

import { Dialog, DialogContent, Icon, cx } from '@eguardimmo/ui';
import type { LinkComponent, NavEntry } from '@eguardimmo/ui';
import type { Navigation } from '../navigation/routes';

export interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigation: Navigation;
  excluded: string[];
  Link: LinkComponent;
}

const linkClass = cx(
  'flex min-h-11 items-center justify-between gap-2 rounded-md px-2.5 text-body-strong text-fg hover:bg-muted',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
);

export function MoreSheet({ open, onOpenChange, navigation, excluded, Link }: MoreSheetProps) {
  const close = () => { onOpenChange(false); };
  const groups = [
    ...navigation.sections.map((section) => ({
      id: section.id,
      label: section.label,
      entries: section.entries.filter((entry) => !excluded.includes(entry.id)),
    })),
    { id: 'compte', label: 'Compte', entries: navigation.footer },
  ].filter((group) => group.entries.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Plus" placement="bottom">
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.label} className="flex flex-col gap-0.5">
              <h3 className="px-2 pb-1.5 text-caption text-fg-subtle">{group.label}</h3>
              <ul className="flex flex-col gap-0.5">
                {group.entries.map((entry) => (
                  <MoreEntry key={entry.id} entry={entry} Link={Link} onSelect={close} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MoreEntry({ entry, Link, onSelect }: { entry: NavEntry; Link: LinkComponent; onSelect: () => void }) {
  const children = entry.children ?? [];
  return (
    <li>
      <Link href={entry.href} onClick={onSelect} className={linkClass}>
        <span className="flex items-center gap-2.5">
          <Icon icon={entry.icon} className="text-fg-subtle" />
          {entry.label}
        </span>
        {entry.count ? <span className="text-caption font-normal text-fg-subtle">{entry.count}</span> : null}
      </Link>
      {children.length > 1 ? (
        <ul className="mb-1 ml-[18px] flex flex-wrap gap-1 border-l border-line pl-3">
          {children.slice(1).map((child) => (
            <li key={child.id}>
              <Link
                href={child.href}
                onClick={onSelect}
                className="inline-flex h-11 items-center rounded-full px-2 text-caption text-fg-muted hover:bg-muted focus-visible:outline-2 focus-visible:outline-focus"
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

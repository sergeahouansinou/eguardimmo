'use client';

import { Count, cx } from '@eguardimmo/ui';
import { TEAM_SECTION_LABEL, staffKindCopy } from '../copy';
import { useStaffConfig } from '../context';
import type { StaffSection } from '../context';
import { useStaffUnread } from '../queries';

export function StaffSectionNav({ current }: { current: StaffSection }) {
  const { Link, routes, capabilities } = useStaffConfig();
  const unread = useStaffUnread();
  const sections: { id: StaffSection; label: string; count: number | undefined }[] = [
    ...capabilities.kinds.map((kind) => ({ id: kind, label: staffKindCopy[kind].section, count: unread?.[kind] })),
    { id: 'team', label: TEAM_SECTION_LABEL, count: unread?.internal },
  ];
  return (
    <nav aria-label="Types de conversation">
      <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 border-b border-line">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={routes.section(section.id)}
              {...(section.id === current ? { 'aria-current': 'page' as const } : {})}
              className={cx(
                '-mb-px flex items-center gap-1.5 border-b-2 px-1 py-2 text-body font-medium',
                section.id === current ? 'border-action text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              )}
            >
              {section.label}
              {section.count === undefined || section.count === 0 ? null : (
                <>
                  <Count value={section.count} tone={section.id === current ? 'active' : 'neutral'} aria-hidden="true" />
                  <span className="sr-only">{`, ${String(section.count)} non lu${section.count > 1 ? 's' : ''}`}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

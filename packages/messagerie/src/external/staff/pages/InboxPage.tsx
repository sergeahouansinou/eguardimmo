'use client';

import { StaffHeader } from '../components/parts';
import { StaffInbox } from '../components/Inbox';
import { StaffSectionNav } from '../components/SectionNav';
import { STAFF_INBOX_SUBTITLE, STAFF_INBOX_TITLE } from '../copy';
import type { StaffKind } from '../model';

export function StaffInboxPage({ kind }: { kind: StaffKind }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <StaffHeader title={STAFF_INBOX_TITLE} subtitle={STAFF_INBOX_SUBTITLE} />
      <StaffSectionNav current={kind} />
      <StaffInbox key={kind} kind={kind} />
    </div>
  );
}

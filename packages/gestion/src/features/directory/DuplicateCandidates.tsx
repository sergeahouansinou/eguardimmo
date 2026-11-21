'use client';

import { useGestionNavigation } from '../locataires/kit';
import { reasonsText } from './labels';
import type { DuplicateCandidate } from './model';
import { directoryPaths } from './paths';

export function DuplicateCandidates({ candidates }: { candidates: readonly DuplicateCandidate[] }) {
  const { Link } = useGestionNavigation();
  return (
    <span role="list" aria-label="Contacts semblables" className="flex flex-col gap-1 rounded-md border border-line p-2">
      {candidates.map((candidate) => (
        <span key={candidate.id} role="listitem" className="flex flex-wrap items-baseline justify-between gap-2 text-body">
          <Link href={directoryPaths.contact(candidate.id)} className="font-medium text-action-on-subtle underline underline-offset-2">{candidate.displayName}</Link>
          <span className="text-caption text-fg-subtle">{reasonsText(candidate.reasons)}</span>
        </span>
      ))}
    </span>
  );
}

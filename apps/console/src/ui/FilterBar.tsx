import type { ReactNode } from 'react';

export function FilterBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="search" aria-label={label} className="flex flex-wrap items-end gap-2 max-sm:flex-col max-sm:items-stretch [&>*]:max-sm:w-full [&>*]:max-sm:flex-none">
      {children}
    </div>
  );
}

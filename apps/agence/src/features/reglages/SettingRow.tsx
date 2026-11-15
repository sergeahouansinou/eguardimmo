import type { ReactNode } from "react";

export function SettingRow({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-w-0 items-center gap-2 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-strong text-fg">{title}</span>
        {hint ? <span className="text-caption text-fg-subtle">{hint}</span> : null}
      </div>
      <div className="min-w-0 sm:w-full sm:justify-self-end">{children}</div>
    </div>
  );
}

export function StaticRow({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-w-0 items-center gap-1 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-strong text-fg">{title}</span>
        {hint ? <span className="text-caption text-fg-subtle">{hint}</span> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-body text-fg sm:justify-end">{children}</div>
    </div>
  );
}

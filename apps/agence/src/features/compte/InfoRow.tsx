import type { ReactNode } from "react";

export function InfoRow({ title, hint, trailing }: { title: string; hint?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <span className="text-body-strong text-fg">{title}</span>
        {hint ? <span className="text-caption text-fg-subtle">{hint}</span> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

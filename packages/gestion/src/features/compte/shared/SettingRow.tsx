import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, cx } from '@eguardimmo/ui';

export function SettingRow({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line py-1.5 first:border-t-0">
      <div className="flex min-w-0 flex-1 basis-56 flex-col">
        <b className="text-body font-medium text-fg">{title}</b>
        {hint ? <span className="text-caption text-fg-subtle">{hint}</span> : null}
      </div>
      <div className="flex max-w-full shrink-0 items-center gap-2 max-sm:w-full max-sm:flex-wrap">{children}</div>
    </div>
  );
}

export function SettingsCard({
  id,
  title,
  aside,
  className,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card role="region" aria-labelledby={id} className={cx('px-4 py-3', className)}>
      <CardHeader>
        <CardTitle as="h2" id={id}>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      {children}
    </Card>
  );
}

export const controlWidth = 'w-full sm:w-[260px]';

import type { ReactNode } from 'react';
import { cx } from '@eguardimmo/ui';

export function SheetHeader({ brand, address, title, numero, date, seal }: { brand: string; address: string; title: string; numero: string; date: string; seal: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-md bg-action text-body-strong text-on-action">
          {brand
            .split(' ')
            .map((word) => word.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <div className="flex flex-col">
          <span className="text-body-strong text-fg">{brand}</span>
          <span className="text-caption text-fg-subtle">{address}</span>
          <span className="mt-1 text-block-title tracking-wide text-action-on-subtle">{title}</span>
        </div>
      </div>
      <div className="flex flex-col items-end text-right">
        <span className="text-body-strong text-fg">N° {numero}</span>
        <span className="text-caption text-fg-subtle">{date}</span>
        <span className="mt-1 rounded-sm bg-muted px-1.5 text-caption text-fg-muted">{seal}</span>
      </div>
    </header>
  );
}

export function InfoGrid({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line py-1">
          <dt className="text-caption text-fg-subtle">{label}</dt>
          <dd className="text-right text-body font-medium text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Strip({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 rounded-md bg-action-subtle px-3 py-1.5 text-caption font-medium text-action-on-subtle">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function SheetTable({ headers, children, label }: { headers: readonly { label: string; numeric?: boolean }[]; children: ReactNode; label: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table aria-label={label} className="w-full min-w-[480px] border-collapse text-body text-fg-muted">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header.label} scope="col" className={cx('border-b border-line px-2 py-1 text-caption font-medium text-fg-subtle', header.numeric ? 'text-right' : 'text-left')}>
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function SectionRow({ span, children, tag, tone = 'neutral' }: { span: number; children: ReactNode; tag?: string; tone?: 'neutral' | 'danger' }) {
  return (
    <tr>
      <td colSpan={span} className="bg-muted px-2 py-1 text-caption font-semibold text-fg-muted">
        {children}
        {tag ? <span className={cx('ml-2 rounded-full px-1.5 text-caption font-medium', tone === 'danger' ? 'bg-danger text-danger-fg' : 'bg-info text-info-fg')}>{tag}</span> : null}
      </td>
    </tr>
  );
}

export function DataRow({ cells, muted = false }: { cells: readonly { value: ReactNode; numeric?: boolean; dim?: boolean }[]; muted?: boolean }) {
  return (
    <tr className={cx('border-b border-line', muted && 'text-fg-subtle')}>
      {cells.map((cell, index) => (
        <td key={index} className={cx('px-2 py-1.5', cell.numeric && 'text-right tabular-nums', cell.dim && 'text-caption text-fg-subtle')}>
          {cell.value}
        </td>
      ))}
    </tr>
  );
}

export function TotalRow({ span, label, value, strong = false }: { span: number; label: string; value: string; strong?: boolean }) {
  return (
    <tr className={cx(strong ? 'bg-action-subtle text-action-on-subtle' : 'border-b border-line')}>
      <td colSpan={span} className={cx('px-2 py-1.5 text-right', strong ? 'text-body-strong' : 'font-medium text-fg')}>
        {label}
      </td>
      <td className={cx('px-2 py-1.5 text-right tabular-nums', strong ? 'text-body-strong' : 'font-medium text-fg')}>{value}</td>
    </tr>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-line bg-page px-3 py-2 text-caption text-fg-muted">{children}</p>;
}

export function Summary({ title, items }: { title: string; items: readonly { label: string; value: string; danger?: boolean }[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="text-caption font-semibold text-fg-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col rounded-md border border-line px-2 py-1">
            <span className="text-caption text-fg-subtle">{item.label}</span>
            <b className={cx('text-body tabular-nums', item.danger ? 'text-fg-danger' : 'text-fg')}>{item.value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Signature({ place, brand }: { place: string; brand: string }) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2">
      <span className="text-body text-fg-muted">{place}</span>
      <div className="flex flex-col items-end gap-1">
        <span aria-hidden="true" className="h-8 w-40 border-b border-line-strong" />
        <span className="text-caption text-fg-subtle">{brand}</span>
      </div>
    </div>
  );
}

export function Legal({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-line pt-2 text-caption text-fg-subtle">
      <b className="font-semibold text-fg-muted">Mentions légales.</b> {children}
    </p>
  );
}

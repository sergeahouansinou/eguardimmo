import { Check } from 'lucide-react';
import { Icon, cx } from '@eguardimmo/ui';

export function Steps({ steps, current, label = 'Étapes' }: { steps: readonly string[]; current: number; label?: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? 'step' : undefined} className="flex items-center gap-2">
            <span
              className={cx(
                'inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                done && 'bg-success text-success-fg',
                active && 'bg-action text-on-action',
                !done && !active && 'bg-muted text-fg-subtle',
              )}
            >
              {done ? <Icon icon={Check} size={14} /> : index + 1}
            </span>
            <span className={cx(active ? 'font-semibold text-fg' : 'text-fg-muted')}>{step}</span>
            {index < steps.length - 1 ? <span aria-hidden="true" className="text-fg-disabled">—</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

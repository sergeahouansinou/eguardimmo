import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';

export interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title'> {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
}

export function EmptyState({ icon, title, description, className, children, ...props }: EmptyStateProps) {
  return (
    <div {...props} className={cx('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-fg-subtle">
        <Icon icon={icon} size={20} />
      </span>
      <strong className="text-empty-title text-fg">{title}</strong>
      {description ? <p className="max-w-[420px] text-body text-fg-subtle">{description}</p> : null}
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

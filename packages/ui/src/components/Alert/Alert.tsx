import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const toneClasses: Record<AlertTone, string> = {
  info: 'border-info-line bg-info text-info-fg',
  success: 'border-success-line bg-success text-success-fg',
  warning: 'border-warning-line bg-warning text-warning-fg',
  danger: 'border-danger-line bg-danger text-danger-fg',
};

const toneIcons: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export interface AlertProps extends Omit<ComponentProps<'div'>, 'title' | 'role'> {
  tone?: AlertTone;
  title?: ReactNode;
}

export function Alert({ tone = 'info', title, className, children, ...props }: AlertProps) {
  return (
    <div
      {...props}
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-body',
        toneClasses[tone],
        className,
      )}
    >
      <Icon icon={toneIcons[tone]} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col">
        {title ? <strong className="font-semibold">{title}</strong> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

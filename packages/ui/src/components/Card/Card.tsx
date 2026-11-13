import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cx('flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4', className)}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cx('flex items-center justify-between gap-2', className)} />;
}

export interface CardTitleProps extends ComponentProps<'h3'> {
  as?: 'h2' | 'h3' | 'h4';
}

export function CardTitle({ as: Heading = 'h3', className, ...props }: CardTitleProps) {
  return <Heading {...props} className={cx('text-block-title text-fg', className)} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cx('text-body text-fg-muted', className)} />;
}

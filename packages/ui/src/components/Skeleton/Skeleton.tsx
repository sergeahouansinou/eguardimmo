import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export type SkeletonShape = 'line' | 'block' | 'circle';

const shapeClasses: Record<SkeletonShape, string> = {
  line: 'h-3 rounded-sm',
  block: 'rounded-lg',
  circle: 'size-8 rounded-full',
};

export interface SkeletonProps extends Omit<ComponentProps<'span'>, 'children'> {
  shape?: SkeletonShape;
}

export function Skeleton({ shape = 'line', className, ...props }: SkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cx('block animate-pulse bg-muted motion-reduce:animate-none', shapeClasses[shape], className)}
    />
  );
}

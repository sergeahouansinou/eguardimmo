import type { LucideIcon, LucideProps } from 'lucide-react';
import { cx } from '../../lib/cx';

export type IconSize = 14 | 16 | 20 | 32;

export interface IconProps extends Omit<LucideProps, 'size' | 'strokeWidth' | 'ref'> {
  icon: LucideIcon;
  size?: IconSize;
  label?: string;
}

export function Icon({ icon: Glyph, size = 16, label, className, ...props }: IconProps) {
  return (
    <Glyph
      {...props}
      size={size}
      strokeWidth={1.75}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('shrink-0', className)}
    />
  );
}

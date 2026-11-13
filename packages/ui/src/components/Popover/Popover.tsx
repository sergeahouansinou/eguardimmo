'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps extends ComponentProps<typeof PopoverPrimitive.Content> {
  'aria-label': string;
}

export function PopoverContent({
  align = 'end',
  sideOffset = 6,
  className,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        {...props}
        role="dialog"
        align={align}
        sideOffset={sideOffset}
        className={cx(
          'z-50 flex max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-line bg-surface text-fg',
          className,
        )}
      />
    </PopoverPrimitive.Portal>
  );
}

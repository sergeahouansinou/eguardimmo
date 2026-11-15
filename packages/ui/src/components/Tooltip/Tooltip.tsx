import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { cx } from '../../lib/cx';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps
  extends Pick<
    ComponentProps<typeof TooltipPrimitive.Root>,
    'open' | 'defaultOpen' | 'onOpenChange' | 'delayDuration'
  > {
  content: ReactNode;
  children: ReactElement;
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side'];
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
  delayDuration = 300,
  ...rootProps
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root delayDuration={delayDuration} {...rootProps}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cx(
              'z-50 max-w-[min(20rem,calc(100vw-1rem))] rounded-sm bg-tooltip px-2 py-1 text-caption break-words text-tooltip-fg',
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

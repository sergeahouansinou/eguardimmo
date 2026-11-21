'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { IconButton } from '../IconButton/IconButton';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogPlacement = 'center' | 'top' | 'bottom';

const placementClasses: Record<DialogPlacement, string> = {
  center: 'top-1/2 left-1/2 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg',
  top: 'top-[12vh] left-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-lg',
  bottom: 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg',
};

export interface DialogContentProps extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  hideTitle?: boolean;
  placement?: DialogPlacement;
  closeLabel?: string;
}

export function DialogContent({
  title,
  description,
  hideTitle = false,
  placement = 'center',
  closeLabel = 'Fermer',
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);
  const focusInitial = (event: Event) => {
    onOpenAutoFocus?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    openedFrom.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = contentRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? contentRef.current;
    target?.focus();
  };
  const restoreFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const origin = openedFrom.current;
    if (origin?.isConnected && origin !== document.body) {
      event.preventDefault();
      origin.focus();
    }
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-nav/40" />
      <DialogPrimitive.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
        ref={contentRef}
        tabIndex={-1}
        onOpenAutoFocus={focusInitial}
        onCloseAutoFocus={restoreFocus}
        className={cx(
          'fixed z-50 flex flex-col outline-none overflow-hidden border border-line bg-surface text-fg',
          placementClasses[placement],
          className,
        )}
      >
        <div className={cx('flex items-center justify-between gap-2 px-4 pt-3', hideTitle && 'sr-only')}>
          <DialogPrimitive.Title className="text-block-title">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <IconButton label={closeLabel} icon={X} variant="secondary" />
          </DialogPrimitive.Close>
        </div>
        {description ? (
          <DialogPrimitive.Description className="px-4 text-body text-fg-muted">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

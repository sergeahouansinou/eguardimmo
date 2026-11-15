'use client';

import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;
export const MenuGroup = MenuPrimitive.Group;

export interface MenuContentProps extends ComponentProps<typeof MenuPrimitive.Content> {
  width?: 'sm' | 'md' | 'lg';
}

const widthClasses = { sm: 'w-60', md: 'w-[296px]', lg: 'w-[360px]' } as const;

export function MenuContent({
  width = 'sm',
  align = 'end',
  sideOffset = 6,
  className,
  ...props
}: MenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        {...props}
        align={align}
        sideOffset={sideOffset}
        className={cx(
          'z-50 flex max-h-[var(--radix-dropdown-menu-content-available-height)] flex-col overflow-y-auto rounded-md border border-line bg-surface p-1 text-fg',
          widthClasses[width],
          className,
        )}
      />
    </MenuPrimitive.Portal>
  );
}

const itemBase =
  'flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-left text-body outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled data-[highlighted]:bg-muted';

export interface MenuItemProps extends Omit<ComponentProps<typeof MenuPrimitive.Item>, 'asChild'> {
  icon?: LucideIcon;
  meta?: ReactNode;
  tone?: 'default' | 'danger';
  href?: string;
}

export function MenuItem({ icon, meta, tone = 'default', href, className, children, ...props }: MenuItemProps) {
  const content = (
    <>
      {icon ? (
        <Icon icon={icon} className={tone === 'danger' ? 'text-fg-danger' : 'text-fg-subtle'} />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta ? <span className="ml-auto text-caption text-fg-subtle">{meta}</span> : null}
    </>
  );
  const classes = cx(itemBase, tone === 'danger' ? 'text-fg-danger' : 'text-fg', className);
  if (href !== undefined) {
    return (
      <MenuPrimitive.Item {...props} asChild>
        <a href={href} className={classes}>
          {content}
        </a>
      </MenuPrimitive.Item>
    );
  }
  return (
    <MenuPrimitive.Item {...props} className={classes}>
      {content}
    </MenuPrimitive.Item>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label {...props} className={cx('px-2 pt-1.5 pb-0.5 text-caption text-fg-subtle', className)} />
  );
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator {...props} className={cx('my-1 h-px bg-line', className)} />;
}

export interface MenuSegmentedOption {
  value: string;
  label: string;
}

export interface MenuSegmentedProps {
  label: string;
  icon?: LucideIcon;
  value: string;
  options: MenuSegmentedOption[];
  onValueChange: (value: string) => void;
}

export function MenuSegmented({ label, icon, value, options, onValueChange }: MenuSegmentedProps) {
  return (
    <div className="flex h-10 items-center justify-between gap-2 px-2 text-body text-fg">
      <span className="flex items-center gap-2">
        {icon ? <Icon icon={icon} className="text-fg-subtle" /> : null}
        {label}
      </span>
      <MenuPrimitive.RadioGroup
        value={value}
        onValueChange={onValueChange}
        aria-label={label}
        className="inline-flex gap-0.5 rounded-md bg-muted p-0.5"
      >
        {options.map((option) => (
          <MenuPrimitive.RadioItem
            key={option.value}
            value={option.value}
            onSelect={(event) => { event.preventDefault(); }}
            className={cx(
              'inline-flex h-6 cursor-pointer items-center rounded-sm border px-2 text-caption outline-none',
              'data-[highlighted]:ring-2 data-[highlighted]:ring-focus',
              option.value === value
                ? 'border-line bg-surface font-semibold text-action-on-subtle'
                : 'border-transparent text-fg-subtle',
            )}
          >
            {option.label}
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </div>
  );
}

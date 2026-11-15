'use client';

import { createContext, use, useId, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';
import { Count } from '../Count/Count';

export type TabsSize = 'sm' | 'md';

interface TabsContextValue {
  baseId: string;
  value: string;
  size: TabsSize;
  select: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const context = use(TabsContext);
  if (!context) throw new Error('Tab, TabList et TabPanel doivent être placés dans Tabs.');
  return context;
}

const idOf = (baseId: string, part: 'tab' | 'panel', value: string) =>
  `${baseId}-${part}-${value.replace(/[^\w-]/g, '_')}`;

export interface TabsProps {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  size?: TabsSize;
  className?: string;
  children: ReactNode;
}

export function Tabs({ value, defaultValue, onValueChange, size = 'md', className, children }: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const select = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };
  return (
    <TabsContext value={{ baseId, value: current, size, select }}>
      <div className={cx('flex min-w-0 flex-col gap-2', className)}>{children}</div>
    </TabsContext>
  );
}

export interface TabListProps extends Omit<ComponentProps<'div'>, 'role'> {
  'aria-label': string;
}

export function TabList({ className, ...props }: TabListProps) {
  return (
    <div
      {...props}
      role="tablist"
      className={cx('relative flex gap-1 overflow-x-auto border-b border-line', className)}
    />
  );
}

function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
  const tabs = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
  );
  const index = tabs.indexOf(event.currentTarget);
  const targets: Record<string, number> = {
    ArrowRight: (index + 1) % tabs.length,
    ArrowLeft: (index - 1 + tabs.length) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  tabs[target]?.focus();
  tabs[target]?.click();
}

export interface TabProps extends Omit<ComponentProps<'button'>, 'value' | 'role'> {
  value: string;
  count?: number;
}

export function Tab({ value, count, className, children, ...props }: TabProps) {
  const tabs = useTabs();
  const selected = tabs.value === value;
  return (
    <button
      {...props}
      type="button"
      role="tab"
      id={idOf(tabs.baseId, 'tab', value)}
      aria-selected={selected}
      aria-controls={idOf(tabs.baseId, 'panel', value)}
      tabIndex={selected ? 0 : -1}
      onClick={() => { tabs.select(value); }}
      onKeyDown={moveFocus}
      className={cx(
        '-mb-px inline-flex items-center gap-1.5 border-b-2 whitespace-nowrap',
        tabs.size === 'sm' ? 'px-2 py-1.5 text-[13px] leading-5' : 'px-2.5 py-2 text-body',
        selected
          ? 'border-action font-semibold text-action-on-subtle'
          : 'border-transparent font-medium text-fg-subtle hover:text-fg',
        focusRing,
        className,
      )}
    >
      {children}
      {count === undefined ? null : <Count value={count} tone={selected ? 'active' : 'neutral'} />}
    </button>
  );
}

export interface TabPanelProps extends Omit<ComponentProps<'div'>, 'role'> {
  value: string;
  keepMounted?: boolean;
}

export function TabPanel({ value, keepMounted = false, className, ...props }: TabPanelProps) {
  const tabs = useTabs();
  const active = tabs.value === value;
  if (!active && !keepMounted) return null;
  return (
    <div
      {...props}
      role="tabpanel"
      id={idOf(tabs.baseId, 'panel', value)}
      aria-labelledby={idOf(tabs.baseId, 'tab', value)}
      className={cx(!active && 'hidden', className)}
    />
  );
}

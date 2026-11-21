'use client';

import { LifeBuoy, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, Button, Icon, Popover, PopoverClose, PopoverContent, PopoverTrigger, Tab, TabList, Tabs, Tooltip, cx } from '@eguardimmo/ui';

export interface WidgetTabSpec {
  value: string;
  label: string;
  count?: number;
}

export interface WidgetFrameProps {
  subtitle: string;
  online: boolean | null;
  tabs: readonly WidgetTabSpec[];
  tab: string;
  onTabChange: (value: string) => void;
  unread?: number;
  children: ReactNode;
}

export function WidgetFrame({ subtitle, online, tabs, tab, onTabChange, unread = 0, children }: WidgetFrameProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-[72px] z-40 md:bottom-4">
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip content="Aide et support" side="left">
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={unread > 0 ? `Aide et support, ${String(unread)} réponse${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Aide et support'}
              className="relative inline-flex size-12 items-center justify-center rounded-full bg-action text-on-action hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Icon icon={open ? X : LifeBuoy} size={20} />
              {unread > 0 && !open ? (
                <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-danger" />
              ) : null}
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent aria-label="Aide et support" side="top" align="end" className="h-[min(600px,calc(100dvh-140px))] w-[400px]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-block-title text-fg">Aide et support</span>
              <span className="text-caption text-fg-subtle">{subtitle}</span>
            </div>
            <div className="flex items-center gap-2">
              {online === null ? null : <Badge tone={online ? 'success' : 'neutral'}>{online ? 'En ligne' : 'Hors ligne'}</Badge>}
              <PopoverClose asChild>
                <Button variant="ghost" size="sm" aria-label="Fermer l’aide">
                  <Icon icon={X} />
                </Button>
              </PopoverClose>
            </div>
          </div>
          <Tabs value={tab} defaultValue={tab} onValueChange={onTabChange} size="sm" className="min-h-0 flex-1 gap-0">
            <TabList aria-label="Rubriques de l’aide" className="px-2">
              {tabs.map((spec) => (
                <Tab key={spec.value} value={spec.value} {...(spec.count === undefined ? {} : { count: spec.count })}>
                  {spec.label}
                </Tab>
              ))}
            </TabList>
            <div className={cx('min-h-0 flex-1 overflow-y-auto p-3')}>{children}</div>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}

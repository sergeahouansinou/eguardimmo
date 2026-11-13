'use client';

import {
  CalendarClock,
  CircleAlert,
  Clock,
  ShieldAlert,
  TrendingUp,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge, Icon, Tab, TabList, TabPanel, Tabs, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import type { BureauTodo, TodoCategory, TodoKind } from '../data/schemas';
import { toneBadge, toneTile } from '../lib/tone';
import { accountRoutes } from '../navigation/routes';
import { CardLink, EmptyLine, SectionCard } from './parts';

const kindIcon: Record<TodoKind, LucideIcon> = {
  impaye: CircleAlert,
  retard: Clock,
  fin_de_bail: CalendarClock,
  revision: TrendingUp,
  intervention: Wrench,
  assurance: ShieldAlert,
  profil: UserRound,
};

const categories: { value: TodoCategory; label: string }[] = [
  { value: 'finances', label: 'Finances' },
  { value: 'baux', label: 'Baux' },
  { value: 'suivi', label: 'Suivi' },
  { value: 'compte', label: 'Compte' },
];

export function TodoCard({ todos, Link }: { todos: BureauTodo[]; Link: LinkComponent }) {
  const [filter, setFilter] = useState('tout');
  const visible = filter === 'tout' ? todos : todos.filter((todo) => todo.category === filter);

  return (
    <SectionCard
      id="bureau-a-traiter"
      title="À traiter"
      aside={
        <CardLink Link={Link} href={accountRoutes.todos}>
          Tout voir, {todos.length}
        </CardLink>
      }
    >
      <Tabs value={filter} onValueChange={setFilter} defaultValue="tout" size="sm">
        <TabList aria-label="Filtrer les actions à traiter">
          <Tab value="tout" count={todos.length}>Tout</Tab>
          {categories.map((category) => (
            <Tab key={category.value} value={category.value} count={todos.filter((todo) => todo.category === category.value).length}>
              {category.label}
            </Tab>
          ))}
        </TabList>
        <TabPanel value={filter}>
          {visible.length === 0 ? (
            <EmptyLine>Rien à traiter dans cette rubrique.</EmptyLine>
          ) : (
            <ul>
              {visible.map((todo) => (
                <li key={todo.id} className="flex min-h-[46px] items-center gap-2.5 border-t border-line py-1 first:border-t-0">
                  <span className={cx('inline-flex size-7 shrink-0 items-center justify-center rounded-md', toneTile[todo.tone])}>
                    <Icon icon={kindIcon[todo.kind]} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-body-strong text-fg">{todo.title}</b>
                    <span className="truncate text-caption text-fg-subtle">{todo.detail}</span>
                  </span>
                  {todo.badge ? (
                    <Badge tone={toneBadge[todo.badge.tone]} className="hidden sm:inline-flex">
                      {todo.badge.label}
                    </Badge>
                  ) : null}
                  <span className="flex shrink-0 justify-end sm:min-w-24">
                    <CardLink Link={Link} href={todo.action.href}>
                      {todo.action.label}
                    </CardLink>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>
      </Tabs>
    </SectionCard>
  );
}

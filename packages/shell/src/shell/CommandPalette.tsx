'use client';

import { CornerDownLeft, FileText, Search } from 'lucide-react';
import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Dialog, DialogContent, Icon, Kbd, cx } from '@eguardimmo/ui';
import type { PageResult } from '../config/types';

const MAX_RESULTS = 8;

const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function filterPages(query: string, pages: PageResult[]): PageResult[] {
  const needle = normalize(query);
  const matches = needle ? pages.filter((page) => normalize(page.label).includes(needle)) : pages;
  return matches.slice(0, MAX_RESULTS);
}

export interface CommandPaletteProps {
  pages: PageResult[];
  placeholder: string;
  note: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (href: string) => void;
}

export function CommandPalette({ pages, placeholder, note, open, onOpenChange, onNavigate }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Recherche" hideTitle placement="top">
        {open ? (
          <PaletteBody
            pages={pages}
            placeholder={placeholder}
            note={note}
            onNavigate={(href) => {
              onOpenChange(false);
              onNavigate(href);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface PaletteBodyProps {
  pages: PageResult[];
  placeholder: string;
  note: string;
  onNavigate: (href: string) => void;
}

function PaletteBody({ pages, placeholder, note, onNavigate }: PaletteBodyProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = filterPages(query, pages);
  const current = results[Math.min(active, results.length - 1)];
  const optionId = (index: number) => `${listId}-option-${String(index)}`;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + results.length) % results.length);
    }
    if (event.key === 'Enter' && current) {
      event.preventDefault();
      onNavigate(current.href);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Icon icon={Search} className="text-fg-subtle" />
        <input
          data-autofocus
          type="search"
          role="combobox"
          aria-label="Rechercher une page"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current ? optionId(results.indexOf(current)) : undefined}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-placeholder"
        />
        <Kbd>Échap</Kbd>
      </div>
      <div id={listId} role="listbox" aria-label="Pages" className="flex max-h-[360px] flex-col overflow-y-auto p-1">
        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-body text-fg-subtle">Aucune page ne correspond à « {query} ».</p>
        ) : (
          results.map((page, index) => (
            <div
              key={page.href}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={page === current}
              onMouseMove={() => { setActive(index); }}
              onMouseDown={(event) => {
                event.preventDefault();
                onNavigate(page.href);
              }}
              className={cx(
                'flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-body text-fg',
                page === current && 'bg-muted',
              )}
            >
              <Icon icon={FileText} className="text-fg-subtle" />
              <span className="flex-1 truncate">{page.label}</span>
              {page === current ? <Icon icon={CornerDownLeft} size={14} className="text-fg-subtle" /> : null}
            </div>
          ))
        )}
      </div>
      <p className="border-t border-line px-4 py-2 text-caption text-fg-subtle">
        {note}
      </p>
    </div>
  );
}

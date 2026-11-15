'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Icon, cx } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import type { HelpArticle, HelpCategory } from '../data/schemas';
import { fold } from '../lib/text';

export function filterHelp(categories: HelpCategory[], query: string): HelpCategory[] {
  const needle = fold(query.trim());
  if (needle === '') return categories;
  return categories
    .map((category) => ({
      ...category,
      articles: category.articles.filter((article) => fold(`${article.question} ${article.answer}`).includes(needle)),
    }))
    .filter((category) => category.articles.length > 0);
}

function FaqItem({ article }: { article: HelpArticle }) {
  const { Link } = useMessagerieConfig();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => { setOpen(!open); }}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-body font-medium text-fg hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="min-w-0">{article.question}</span>
        <Icon icon={ChevronDown} className={cx('text-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-1.5 px-3 pb-3 text-body text-fg-muted">
        <p className="break-words whitespace-pre-wrap">{article.answer}</p>
        {article.href ? (
          <Link href={article.href} className="w-fit font-medium text-action-on-subtle underline underline-offset-3">
            {article.hrefLabel ?? 'En savoir plus'}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function FaqAccordion({ categories, compact = false }: { categories: HelpCategory[]; compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {categories.map((category) => (
        <section key={category.id} aria-label={category.title} className="flex min-w-0 flex-col gap-1.5">
          <h2 className={cx('text-fg', compact ? 'text-caption font-semibold text-fg-subtle' : 'text-block-title')}>{category.title}</h2>
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {category.articles.map((article) => (
              <FaqItem key={article.id} article={article} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

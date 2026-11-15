import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';
import { Icon } from '../Icon/Icon';
import type { LinkComponent } from '../SideNav/types';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
  Link: LinkComponent;
  label?: string;
  className?: string;
}

export function Breadcrumb({ items, Link, label = 'Fil d’Ariane', className }: BreadcrumbProps) {
  const lastIndex = items.length - 1;
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-caption text-fg-subtle">
        {items.map((item, index) => (
          <Fragment key={`${String(index)}-${item.label}`}>
            <li className="min-w-0">
              {item.href && index !== lastIndex ? (
                <Link href={item.href} className={cx('rounded-sm hover:text-fg hover:underline', focusRing)}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={index === lastIndex ? 'page' : undefined} className={cx(index === lastIndex && 'font-medium text-fg-muted')}>
                  {item.label}
                </span>
              )}
            </li>
            {index < lastIndex ? (
              <li aria-hidden="true" className="flex">
                <Icon icon={ChevronRight} size={14} />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

import type { BreadcrumbItem } from '@eguardimmo/ui';
import type { Tone } from '@eguardimmo/shell';

export interface ChargesLineView {
  id: string;
  label: string;
  split: string;
  base: string | null;
  days: number | null;
  amount: string;
}

export interface ChargesStatView {
  label: string;
  value: string;
  note: string;
}

export interface ChargesView {
  title: string;
  crumbs: readonly BreadcrumbItem[];
  badge: { label: string; tone: Tone };
  subtitle: string;
  stats: readonly ChargesStatView[];
  tableTitle: string;
  amountHeader: string;
  lines: readonly ChargesLineView[];
  totalLabel: string;
  total: string;
  calculation: readonly { label: string; value: string; strong?: boolean }[];
  extra: { title: string; items: readonly { label: string; value: string }[] } | null;
}

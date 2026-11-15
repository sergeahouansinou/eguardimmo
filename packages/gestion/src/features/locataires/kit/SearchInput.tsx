import { Search } from 'lucide-react';
import { Icon } from '@eguardimmo/ui';

export function SearchInput({
  label,
  placeholder,
  value,
  onValueChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="relative flex w-full min-w-0 sm:w-60">
      <span className="sr-only">{label}</span>
      <Icon icon={Search} className="pointer-events-none absolute top-2 left-2.5 text-fg-subtle" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => { onValueChange(event.target.value); }}
        className="h-8 w-full rounded-sm border border-line-control bg-surface pr-2.5 pl-8 text-body text-fg placeholder:text-fg-placeholder focus:border-focus focus:outline-2 focus:-outline-offset-1 focus:outline-focus"
      />
    </label>
  );
}

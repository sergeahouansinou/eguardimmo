import { Switch } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface SwitchRowProps {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ label, hint, checked, onCheckedChange, disabled }: SwitchRowProps) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0">
      <Switch label={label} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      {hint ? <p className="text-caption text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

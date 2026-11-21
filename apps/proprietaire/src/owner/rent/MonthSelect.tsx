"use client";

import { Select } from "@eguardimmo/ui";
import { monthOptions } from "./months";

export function MonthSelect({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  return <Select label="Mois" placeholder="Choisissez un mois" value={value} onValueChange={onChange} options={monthOptions(value)} />;
}

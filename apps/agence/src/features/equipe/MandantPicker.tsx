import { SegmentedControl } from "@eguardimmo/ui";
import { CheckCards } from "@/features/kit";
import { MANDANTS } from "@/features/shared/directory";
import type { PortfolioMode } from "./schemas";

const MODE_OPTIONS = [
  { value: "all", label: "Tous les mandants" },
  { value: "chosen", label: "Mandants choisis" },
] as const;

const MANDANT_OPTIONS = MANDANTS.map((mandant) => ({ value: mandant.id, label: mandant.name, description: mandant.kind }));

export interface MandantPickerProps {
  mode: PortfolioMode;
  mandantIds: readonly string[];
  onModeChange: (mode: PortfolioMode) => void;
  onMandantIdsChange: (ids: readonly string[]) => void;
  error?: string;
}

export function MandantPicker({ mode, mandantIds, onModeChange, onMandantIdsChange, error }: MandantPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label="Mandants confiés"
        options={MODE_OPTIONS}
        value={mode}
        onValueChange={(value) => {
          onModeChange(value === "chosen" ? "chosen" : "all");
        }}
      />
      {mode === "chosen" ? (
        <CheckCards
          legend="Mandants"
          options={MANDANT_OPTIONS}
          values={mandantIds}
          onValuesChange={onMandantIdsChange}
          error={error}
        />
      ) : null}
      <p className="text-caption text-fg-subtle">Il ne voit que les biens, locataires et documents de ces mandants.</p>
    </div>
  );
}

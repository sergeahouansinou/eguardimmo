import { ArrowRight } from "lucide-react";
import { Icon } from "@eguardimmo/ui";

export function ContextBanner({ spaceLabel }: { spaceLabel: string }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-info-line bg-info px-3 py-2 text-body text-info-fg">
      <Icon icon={ArrowRight} />
      <span>
        Vous poursuivez vers <strong className="font-semibold">{spaceLabel}</strong>
      </span>
    </p>
  );
}

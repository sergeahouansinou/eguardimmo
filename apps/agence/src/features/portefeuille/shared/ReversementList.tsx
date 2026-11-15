import { Banknote } from "lucide-react";
import { ListRow } from "@/components/ui/ListRow";
import { formatDay, ofMonth } from "@/lib/dates";
import { formatEurosExact } from "@/lib/money";
import type { ReversementLine } from "../selectors";

export function ReversementList({ lines, limit }: { lines: readonly ReversementLine[]; limit?: number }) {
  const shown = limit === undefined ? lines : lines.slice(0, limit);
  if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucun reversement exécuté pour le moment.</p>;
  return (
    <div>
      {shown.map((line) => (
        <ListRow
          key={line.id}
          icon={Banknote}
          tone="success"
          title={`Reversement ${ofMonth(`${line.month}-01`)}`}
          caption={`${formatDay(line.payoutIso)} · ${formatEurosExact(line.collectedMinor)} encaissés, ${formatEurosExact(line.feeMinor)} d'honoraires`}
          trailing={<strong className="tabular-nums text-fg">{formatEurosExact(line.netMinor)}</strong>}
        />
      ))}
    </div>
  );
}

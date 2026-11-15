"use client";

import { Badge, Button } from "@eguardimmo/ui";
import { FileText } from "lucide-react";
import { ListRow } from "@/components/ui/ListRow";
import { useDemoDownload } from "@/components/ui/useDemoDownload";
import type { DocumentItem } from "../detailItems";

export function DocumentList({ items, limit }: { items: readonly DocumentItem[]; limit?: number }) {
  const download = useDemoDownload();
  const shown = limit === undefined ? items : items.slice(0, limit);
  if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">Aucun document pour le moment.</p>;
  return (
    <div>
      {shown.map((item) => (
        <ListRow
          key={item.id}
          icon={FileText}
          tone="info"
          title={item.title}
          caption={item.meta}
          trailing={
            <>
              {item.badge ? <Badge tone="info">{item.badge}</Badge> : null}
              <Button variant="link" aria-label={`Télécharger ${item.title}`} onClick={() => { download(item.title); }}>
                Télécharger
              </Button>
            </>
          }
        />
      ))}
    </div>
  );
}

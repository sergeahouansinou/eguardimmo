import { Badge } from "@eguardimmo/ui";
import { Activity } from "lucide-react";
import { ListRow } from "@/components/ui/ListRow";
import { formatDay } from "@/lib/dates";
import type { ActivityEvent } from "../schemas";

export function EventList({ events, limit, empty = "Aucune activité pour le moment." }: { events: readonly ActivityEvent[]; limit?: number; empty?: string }) {
  const shown = limit === undefined ? events : events.slice(0, limit);
  if (shown.length === 0) return <p className="py-2 text-body text-fg-subtle">{empty}</p>;
  return (
    <div>
      {shown.map((event) => (
        <ListRow
          key={event.id}
          icon={Activity}
          tone={event.tone}
          title={event.title}
          caption={`${formatDay(event.dateIso)} · ${event.detail}`}
          trailing={event.badge ? <Badge tone={event.tone === "neutral" ? "neutral" : event.tone}>{event.badge}</Badge> : null}
        />
      ))}
    </div>
  );
}

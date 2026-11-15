import type { LastChange as LastChangeValue } from '@/console/schemas';
import { formatDateTime } from '@/lib/format';
import { KeyValueList, Section } from '@/ui/Section';

export function LastChange({ change }: { change: LastChangeValue }) {
  return (
    <Section id="derniere-modification" title="Dernière modification">
      <KeyValueList
        items={[
          { label: 'Date', value: formatDateTime(change.at) },
          { label: 'Par', value: change.by },
          { label: 'Changement', value: change.summary },
        ]}
      />
    </Section>
  );
}

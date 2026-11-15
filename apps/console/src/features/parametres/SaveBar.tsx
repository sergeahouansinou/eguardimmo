import { Button } from '@eguardimmo/ui';

export function SaveBar({ pending, dirty, onCancel }: { pending: boolean; dirty: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="secondary" disabled={!dirty || pending} onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" loading={pending} disabled={!dirty}>
        Enregistrer
      </Button>
    </div>
  );
}

'use client';

import { Select } from '@eguardimmo/ui';
import { SIGNATURE_PAGES } from './schemas';
import type { SignatureField } from './schemas';

const COLUMNS = [{ value: 'gauche', label: 'À gauche', x: 20 }, { value: 'centre', label: 'Au centre', x: 50 }, { value: 'droite', label: 'À droite', x: 80 }] as const;
const ROWS = [{ value: 'haut', label: 'En haut', y: 15 }, { value: 'milieu', label: 'Au milieu', y: 50 }, { value: 'bas', label: 'En bas', y: 85 }] as const;
const MARKS = ['bg-action text-on-action', 'bg-fg text-fg-inverse', 'bg-fg-danger text-fg-inverse', 'border border-line bg-warning text-fg'];

const columnOf = (x: number) => (x < 34 ? 'gauche' : x < 67 ? 'centre' : 'droite');
const rowOf = (y: number) => (y < 34 ? 'haut' : y < 67 ? 'milieu' : 'bas');

export function SignaturePlacement({
  signers,
  fields,
  active,
  page,
  onActiveChange,
  onPageChange,
  onFieldsChange,
}: {
  signers: readonly { name: string }[];
  fields: readonly SignatureField[];
  active: number;
  page: number;
  onActiveChange: (signer: number) => void;
  onPageChange: (page: number) => void;
  onFieldsChange: (fields: SignatureField[]) => void;
}) {
  const current = fields.find((field) => field.signer === active) ?? { signer: active, page: SIGNATURE_PAGES, x: 50, y: 85 };
  const place = (changes: Partial<SignatureField>) => {
    const next = { ...current, ...changes };
    onFieldsChange([...fields.filter((field) => field.signer !== active), next].sort((a, b) => a.signer - b.signer));
    if (changes.page !== undefined) onPageChange(changes.page);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
      <div className="flex flex-col gap-2">
        <div className="flex justify-center rounded-md bg-muted p-3">
          <button
            data-paper=""
            type="button"
            tabIndex={-1}
            aria-label={`Page ${String(page)}, cliquer pour placer la signature du signataire ${String(active + 1)}`}
            className="relative block aspect-[210/297] w-full max-w-[300px] cursor-crosshair border border-line"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              if (event.detail === 0 || box.width === 0 || box.height === 0) return;
              place({ page, x: Math.round(((event.clientX - box.left) / box.width) * 100), y: Math.round(((event.clientY - box.top) / box.height) * 100) });
            }}
          >
            <span aria-hidden="true" className="flex flex-col gap-1.5 p-4">
              {Array.from({ length: 14 }, (_, line) => (
                <span key={line} className="block h-1 rounded-full bg-muted" style={{ width: `${String(60 + ((line * 17) % 40))}%` }} />
              ))}
            </span>
            {fields
              .filter((field) => field.page === page)
              .map((field) => (
                <span
                  key={field.signer}
                  aria-hidden="true"
                  style={{ left: `${String(field.x)}%`, top: `${String(field.y)}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-sm px-1.5 py-0.5 text-caption font-semibold ${MARKS[field.signer % MARKS.length] ?? ''}`}
                >
                  {`Signature ${String(field.signer + 1)}`}
                </span>
              ))}
          </button>
        </div>
        <p className="text-caption text-fg-subtle">Cliquez sur la page pour placer le champ, ou utilisez les listes ci-contre.</p>
      </div>
      <div className="flex flex-col gap-3">
        <Select
          label="Signataire"
          placeholder="Choisir un signataire"
          value={String(active)}
          onValueChange={(value) => { onActiveChange(Number(value)); onPageChange((fields.find((field) => field.signer === Number(value))?.page) ?? page); }}
          options={signers.map((signer, index) => ({ value: String(index), label: `${String(index + 1)}. ${signer.name}` }))}
        />
        <Select
          label="Page du champ"
          placeholder="Page"
          value={String(current.page)}
          onValueChange={(value) => { place({ page: Number(value) }); }}
          options={Array.from({ length: SIGNATURE_PAGES }, (_, index) => ({ value: String(index + 1), label: `Page ${String(index + 1)} sur ${String(SIGNATURE_PAGES)}` }))}
        />
        <Select
          label="Position horizontale"
          placeholder="Position"
          value={columnOf(current.x)}
          onValueChange={(value) => { place({ x: COLUMNS.find((entry) => entry.value === value)?.x ?? 50 }); }}
          options={COLUMNS.map((entry) => ({ value: entry.value, label: entry.label }))}
        />
        <Select
          label="Position verticale"
          placeholder="Position"
          value={rowOf(current.y)}
          onValueChange={(value) => { place({ y: ROWS.find((entry) => entry.value === value)?.y ?? 85 }); }}
          options={ROWS.map((entry) => ({ value: entry.value, label: entry.label }))}
        />
      </div>
    </div>
  );
}

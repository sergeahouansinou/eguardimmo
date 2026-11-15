'use client';

import { Button, Dialog, DialogContent, Icon, cx } from '@eguardimmo/ui';
import { Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { plural } from '../lib/text';
import { FilePicker } from './FilePicker';
import { Panel } from './Panels';

export interface PhotoTile {
  id: string;
  label: string;
  cover: boolean;
}

function Tile({ photo, className }: { photo: PhotoTile; className?: string }) {
  return (
    <figure className={cx('flex min-h-20 flex-col items-center justify-center gap-1 rounded-md bg-muted p-2 text-center', className)}>
      <Icon icon={ImageIcon} size={20} className="text-fg-subtle" />
      <figcaption className="text-caption text-fg-muted">
        {photo.cover ? `Couverture · ${photo.label}` : photo.label}
      </figcaption>
    </figure>
  );
}

export interface PhotosPanelProps {
  photos: readonly PhotoTile[];
  count: number;
  pending: boolean;
  onAdd: (names: string[]) => void;
}

export function PhotosPanel({ photos, count, pending, onAdd }: PhotosPanelProps) {
  const [adding, setAdding] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const shown = photos.slice(0, 5);
  const hidden = Math.max(0, count - shown.length);
  return (
    <Panel
      title={`Photos ${String(count)}`}
      action={
        <div className="flex flex-wrap gap-1">
          <Button variant="secondary" size="sm" onClick={() => { setAdding(true); }}>
            Ajouter des photos
          </Button>
          <Button variant="ghost" size="sm" disabled={photos.length === 0} onClick={() => { setGallery(true); }}>
            Voir la galerie
          </Button>
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="text-body text-fg-muted">Aucune photo pour le moment. Ajoutez des photos pour valoriser le bien.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((photo, index) => (
            <Tile key={photo.id} photo={photo} className={index === 0 ? 'col-span-2 row-span-2 sm:col-span-2' : undefined} />
          ))}
          {hidden > 0 ? (
            <button type="button" onClick={() => { setGallery(true); }} className="flex min-h-20 items-center justify-center rounded-md bg-muted text-body font-medium text-fg-muted hover:bg-line">
              {`+${plural(hidden, 'photo')}`}
            </button>
          ) : null}
        </div>
      )}
      <Dialog open={gallery} onOpenChange={setGallery}>
        <DialogContent title="Galerie" description={plural(count, 'photo')} className="max-h-[85vh]">
          <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
            {photos.map((photo) => (
              <Tile key={photo.id} photo={photo} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={adding} onOpenChange={(open) => { setAdding(open); if (!open) setNames([]); }}>
        <DialogContent title="Ajouter des photos" description="JPG ou PNG, 10 Mo au maximum par fichier.">
          <div className="flex flex-col gap-3 p-4">
            <FilePicker
              label="Déposer les photos ici"
              hint="JPG ou PNG, 10 Mo au maximum"
              accept={['image/jpeg', 'image/png', '.jpg', '.jpeg', '.png']}
              multiple
              onPick={(files) => { setNames((current) => [...new Set([...current, ...files.map((file) => file.name)])]); }}
            />
            {names.length > 0 ? <p className="text-body text-fg">{names.join(', ')}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setAdding(false); setNames([]); }}>
                Annuler
              </Button>
              <Button
                disabled={names.length === 0}
                loading={pending}
                onClick={() => {
                  onAdd(names);
                  setAdding(false);
                  setNames([]);
                }}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

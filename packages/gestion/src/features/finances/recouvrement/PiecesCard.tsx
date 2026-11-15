'use client';

import { Download, PackageCheck, Send } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CardHeader, CardTitle, Checkbox, Icon } from '@eguardimmo/ui';
import { formatDate } from '../dates';
import { shortHash } from '../seal';
import type { Liasse, Piece } from '../schemas';
import { formatOctets } from './pieces';

export function PiecesCard({
  pieces,
  liasses,
  generating,
  onGenerate,
  onDownload,
  onTransmit,
}: {
  pieces: readonly Piece[];
  liasses: readonly Liasse[];
  generating: boolean;
  onGenerate: (exclues: string[]) => void;
  onDownload: (liasse: Liasse) => void;
  onTransmit: (liasse: Liasse) => void;
}) {
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const kept = pieces.filter((piece) => !excluded.has(piece.id));
  const latest = liasses.at(-1);
  const toggle = (id: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <Card aria-labelledby="re-pieces">
      <CardHeader className="flex-wrap">
        <CardTitle as="h2" id="re-pieces">Pièces du dossier</CardTitle>
        <Badge>{kept.length} pièce{kept.length > 1 ? 's' : ''} · {formatOctets(kept.reduce((total, piece) => total + piece.octets, 0))}</Badge>
      </CardHeader>
      <ul aria-label="Pièces retenues pour l’envoi" className="flex flex-col rounded-md border border-line">
        {pieces.map((piece) => (
          <li key={piece.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-3 py-1.5 first:border-t-0">
            <Checkbox label={piece.libelle} checked={!excluded.has(piece.id)} disabled={!piece.facultative} onChange={() => { toggle(piece.id); }} />
            <span className="flex items-center gap-2 text-caption text-fg-subtle">
              {piece.facultative ? null : <Badge tone="info">Obligatoire</Badge>}
              {formatOctets(piece.octets)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant={latest ? 'secondary' : 'primary'} loading={generating} onClick={() => { onGenerate([...excluded].filter((id) => pieces.some((piece) => piece.id === id))); }}>
          <Icon icon={PackageCheck} />
          Générer l’envoi
        </Button>
        {latest ? (
          <>
            <Button variant="secondary" onClick={() => { onDownload(latest); }}>
              <Icon icon={Download} />
              Télécharger le ZIP
            </Button>
            <Button className="h-auto! max-w-full py-1.5! whitespace-normal!" onClick={() => { onTransmit(latest); }}>
              <Icon icon={Send} />
              Transmettre au commissaire de justice
            </Button>
          </>
        ) : null}
      </div>
      {liasses.length === 0 ? (
        <p className="text-caption text-fg-subtle">Aucun envoi généré. Le ZIP n’existe qu’après « Générer l’envoi » : la liste est alors figée.</p>
      ) : (
        <ul aria-label="Envois générés" className="flex flex-col text-body">
          {[...liasses].reverse().map((liasse) => (
            <li key={liasse.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-line py-1.5 first:border-t-0">
              <span>
                Envoi du {formatDate(liasse.genereLe)} · {liasse.pieces.length} pièces · {formatOctets(liasse.octets)}
              </span>
              <span className="flex items-center gap-2 text-caption text-fg-subtle">
                {liasse.empreinte ? `SHA-256 ${shortHash(liasse.empreinte)}` : null}
                {liasse.id === latest?.id ? <Badge tone="success">Dernier envoi</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

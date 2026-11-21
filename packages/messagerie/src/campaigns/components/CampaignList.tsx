'use client';

import { Button, cx } from '@eguardimmo/ui';
import { EmptyBlock } from '../../components/parts';
import { CampaignRow, ROW_GRID } from './CampaignRow';
import type { Campaign } from '../model';

export interface CampaignListProps {
  items: readonly Campaign[];
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function CampaignList({ items, filtered, hasMore, loadingMore, onLoadMore }: CampaignListProps) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        title={filtered ? 'Aucune campagne ne correspond à ces filtres' : 'Aucune campagne ici'}
        hint={filtered ? 'Modifiez la recherche, l’immeuble ou la période.' : 'Créez une campagne pour écrire à plusieurs personnes à la fois.'}
      />
    );
  }
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div aria-hidden="true" className={cx('hidden gap-x-3 border-b border-line bg-muted px-3 py-2 text-caption text-fg-subtle md:grid', ROW_GRID)}>
          <span>Campagne</span>
          <span>Destinataires</span>
          <span>Envoi</span>
          <span>Lus</span>
          <span>État</span>
          <span />
        </div>
        <ul aria-label="Campagnes">
          {items.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </ul>
      </div>
      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={onLoadMore}>
            Afficher plus
          </Button>
        </div>
      ) : null}
    </>
  );
}

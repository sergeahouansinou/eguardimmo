<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Data\Receivable;
use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;

final readonly class OpenItems
{
    /**
     * Créances déjà portées par une ligne ouverte d'un dossier actif : identifiant de la créance => identifiant du dossier.
     *
     * @param  list<string>  $itemIds
     * @return array<string, string>
     */
    public function takenBy(ItemType $type, array $itemIds): array
    {
        $pris = [];

        foreach (array_chunk($itemIds, 500) as $lot) {
            $lignes = RecoveryCaseItem::query()
                ->where('item_type', $type->value)
                ->whereIn('item_id', $lot)
                ->whereNull('removed_at')
                ->whereIn('case_id', RecoveryCase::query()->whereIn('status', array_map(fn (CaseStatus $s): string => $s->value, CaseStatus::active()))->select('id'))
                ->get(['item_id', 'case_id']);

            foreach ($lignes as $ligne) {
                $pris[$ligne->item_id] = $ligne->case_id;
            }
        }

        return $pris;
    }

    /**
     * Comme `takenBy`, pour des créances de types mêlés.
     *
     * @param  list<Receivable>  $creances
     * @return array<string, string>
     */
    public function takenByReceivables(array $creances): array
    {
        $pris = [];

        foreach (ItemType::cases() as $type) {
            $ids = array_values(array_map(fn (Receivable $c): string => $c->id, array_filter($creances, fn (Receivable $c): bool => $c->type === $type)));
            $pris += $ids === [] ? [] : $this->takenBy($type, $ids);
        }

        return $pris;
    }
}

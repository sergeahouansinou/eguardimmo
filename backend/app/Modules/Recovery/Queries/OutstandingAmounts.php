<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Recovery\Support\Currencies;
use Money\Money;

final readonly class OutstandingAmounts
{
    public function __construct(private LedgerReader $grandLivre) {}

    /**
     * Reste dû au grand livre de chaque ligne, par identifiant de créance : une échéance et une facture se lisent chacune
     * sous leur type de pièce comptable. Les avoirs et règlements sont déjà déduits.
     *
     * @param  iterable<RecoveryCaseItem>  $lignes
     * @return array<string, Money>
     */
    public function of(iterable $lignes): array
    {
        $groupes = [];

        foreach ($lignes as $ligne) {
            $groupes[$ligne->item_type->value.'|'.$ligne->currency][] = $ligne;
        }

        $restes = [];

        foreach ($groupes as $groupe) {
            $restes += $this->grandLivre->outstandingMany(
                $groupe[0]->item_type->ledgerType(),
                array_values(array_unique(array_map(fn (RecoveryCaseItem $l): string => $l->item_id, $groupe))),
                Currencies::of($groupe[0]->currency),
            );
        }

        return $restes;
    }
}

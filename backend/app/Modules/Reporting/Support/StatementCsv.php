<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Accounting\Data\PartyStatementData;

final class StatementCsv
{
    public static function render(PartyStatementData $releve, string $devise): string
    {
        $lignes = [['date', 'reference', 'libelle', 'debit_minor', 'credit_minor', 'solde_minor', 'devise']];

        foreach ($releve->lines as $l) {
            $lignes[] = [$l->date->toDateString(), $l->reference, $l->label, (int) $l->debit->getAmount(), (int) $l->credit->getAmount(), (int) $l->balance->getAmount(), $devise];
        }

        return Csv::render($lignes);
    }
}

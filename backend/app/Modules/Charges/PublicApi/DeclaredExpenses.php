<?php

declare(strict_types=1);

namespace App\Modules\Charges\PublicApi;

use App\Modules\Charges\Data\DeclaredExpenseData;
use App\Modules\Charges\Queries\DeclaredExpenseReader;
use Carbon\CarbonImmutable;

/**
 * Dépenses `paid_by_owner` et `none` de l'organisation courante : sans écriture au grand livre, elles ne se lisent que d'ici et restent « déclarées »
 * (Reporting, Tax). Une dépense annulée ou en attente de validation n'en fait pas partie.
 */
final readonly class DeclaredExpenses
{
    public function __construct(private DeclaredExpenseReader $lecteur) {}

    /**
     * @param  list<string>|null  $unitIds  null : tous les lots ; liste vide : aucun
     * @return list<DeclaredExpenseData> par date, puis identifiant
     */
    public function between(CarbonImmutable $from, CarbonImmutable $toExclusive, ?array $unitIds = null): array
    {
        return $this->lecteur->between($from, $toExclusive, $unitIds);
    }
}

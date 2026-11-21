<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Leases\Data\LeaseData;
use App\Modules\Parties\Data\PartyData;
use Money\Money;

/**
 * Données de présentation d'une page de dossiers, lues en quelques requêtes pour toute la page.
 */
final readonly class CaseView
{
    /**
     * @param  array<string, LeaseData>  $leases
     * @param  array<string, PartyData>  $parties
     * @param  array<string, Money>  $outstanding  reste dû au grand livre par créance
     */
    public function __construct(
        public array $leases,
        public array $parties,
        public array $outstanding,
    ) {}
}

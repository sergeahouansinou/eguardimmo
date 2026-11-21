<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Leases\Data\LeaseData;
use App\Modules\Rent\Enums\ReceiptState;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Données de présentation d'une page d'échéances, lues en quelques requêtes pour toute la page.
 */
final readonly class InstallmentView
{
    /**
     * @param  array<string, Money>  $outstanding  reste dû au grand livre, pour les échéances appelées
     * @param  array<string, LeaseData>  $leases
     * @param  array<string, ReceiptState>  $receiptStates
     */
    public function __construct(
        public array $outstanding,
        public array $leases,
        public array $receiptStates,
        public CarbonImmutable $today,
    ) {}
}

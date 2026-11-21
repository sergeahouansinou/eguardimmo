<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class OwnerBackfillItemData
{
    /**
     * @param  int  $called  montant appelé, en unités mineures
     * @param  int  $collected  montant déjà encaissé et imputé sur l'échéance, en unités mineures
     */
    public function __construct(
        public string $installmentId,
        public string $leaseId,
        public string $mandateId,
        public string $mandantPartyId,
        public string $periodStart,
        public int $called,
        public int $collected,
        public int $allocations,
    ) {}
}

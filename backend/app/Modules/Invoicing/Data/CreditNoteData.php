<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class CreditNoteData
{
    /**
     * @param  bool  $full  solde de toutes les lignes ; sinon `$lines` porte les quantités créditées
     * @param  list<CreditLineData>  $lines
     */
    public function __construct(
        public string $reason,
        public bool $full,
        public array $lines,
        public string $idempotencyKey,
    ) {}
}

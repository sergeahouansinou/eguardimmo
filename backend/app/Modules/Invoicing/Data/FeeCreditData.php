<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

final readonly class FeeCreditData
{
    /**
     * @param  int  $creditedNetMinor  hors taxe réellement crédité (jamais plus que demandé)
     * @param  int  $recreditedMinor  part recréditée au compte du mandant
     */
    public function __construct(
        public string $creditNoteId,
        public string $number,
        public string $creditedInvoiceId,
        public int $creditedNetMinor,
        public int $grossMinor,
        public int $recreditedMinor,
    ) {}
}

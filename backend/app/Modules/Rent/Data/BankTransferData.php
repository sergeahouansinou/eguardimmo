<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

final readonly class BankTransferData
{
    /**
     * @param  int  $amount  unités mineures de la devise du bail : la devise ne vient jamais de l'appelant
     * @param  string  $receivedOn  Y-m-d, date de comptabilisation de la ligne de relevé
     */
    public function __construct(
        public string $leaseId,
        public int $amount,
        public string $receivedOn,
        public ?string $reference,
        public string $idempotencyKey,
    ) {}
}

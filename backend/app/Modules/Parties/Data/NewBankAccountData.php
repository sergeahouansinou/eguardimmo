<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use Carbon\CarbonImmutable;

final readonly class NewBankAccountData
{
    public function __construct(
        public string $iban,
        public ?string $bic,
        public string $holderName,
        public CarbonImmutable $validFrom,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use Money\Money;

final readonly class ShareSplit
{
    /**
     * @param  array<string, Money>  $shares  part de chaque bail, arrondie à l'unité mineure inférieure
     * @param  Money  $owner  reste au propriétaire : vacance, forfait, arrondis ; jamais négatif
     */
    public function __construct(
        public array $shares,
        public Money $owner,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class MandateFeeScheduleData
{
    /**
     * @param  list<array{unit_id: string, valid_from: string, valid_to: string|null}>  $units  lots couverts, fin exclue
     * @param  list<MandateFeeTermData>  $terms  barèmes successifs, du plus ancien au plus récent
     * @param  string  $endsOn  premier jour qui n'est plus couvert
     */
    public function __construct(
        public string $mandateId,
        public string $reference,
        public string $mandantPartyId,
        public string $currency,
        public string $startsOn,
        public string $endsOn,
        public array $units,
        public array $terms,
    ) {}
}

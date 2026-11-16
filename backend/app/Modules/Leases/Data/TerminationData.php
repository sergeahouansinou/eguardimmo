<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\NoticeGivenBy;

final readonly class TerminationData
{
    /**
     * @param  string|null  $endsOn  Y-m-d, dernier jour exclu ; absent : date de départ du préavis enregistré
     * @param  bool  $amicable  résiliation hors préavis légal : motif obligatoire, et demandeur sans préavis enregistré
     */
    public function __construct(
        public int $lockVersion,
        public ?string $endsOn,
        public bool $amicable,
        public ?string $terminationReason,
        public ?NoticeGivenBy $requestedBy,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

use App\Modules\Tax\Enums\SummaryScope;

final readonly class NewSummaryData
{
    public function __construct(
        public SummaryScope $scope,
        public ?string $mandantPartyId,
        public RentalIncomeData $income,
        public string $ledgerCutoff,
        public string $idempotencyKey,
        public string $requestHash,
        public string $activeKey,
        public ?string $supersedesId,
        public ?string $reason,
        public ?string $userId,
        public ?string $holderName,
    ) {}
}

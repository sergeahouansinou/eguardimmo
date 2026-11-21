<?php

declare(strict_types=1);

namespace App\Modules\Banking\Data;

use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\RuleAction;

final readonly class BankRuleData
{
    public function __construct(
        public string $name,
        public ?string $labelContains,
        public ?string $counterpartyLineId,
        public ?string $transactionCode,
        public ?int $amountMin,
        public ?int $amountMax,
        public ?Direction $direction,
        public RuleAction $action,
        public ?string $targetLeaseId,
        public ?IgnoreReason $ignoreReason,
        public Confidence $confidence,
        public bool $active,
        public ?int $position,
    ) {}
}

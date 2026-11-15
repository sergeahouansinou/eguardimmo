<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use Money\Money;

final readonly class PostedLineData
{
    public function __construct(
        public string $id,
        public AccountRole $account,
        public string $accountCode,
        public Money $debit,
        public Money $credit,
        public ?string $leaseId,
        public ?string $partyId,
        public ?string $unitId,
        public ?ItemType $itemType,
        public ?string $itemId,
    ) {}
}

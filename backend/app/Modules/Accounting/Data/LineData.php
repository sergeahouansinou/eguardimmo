<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Side;
use Money\Money;

final readonly class LineData
{
    public function __construct(
        public AccountRole $account,
        public Side $side,
        public Money $amount,
        public ?string $leaseId = null,
        public ?string $partyId = null,
        public ?string $unitId = null,
        public ?ItemType $itemType = null,
        public ?string $itemId = null,
    ) {}

    public static function debit(
        AccountRole $account,
        Money $amount,
        ?string $leaseId = null,
        ?string $partyId = null,
        ?string $unitId = null,
        ?ItemType $itemType = null,
        ?string $itemId = null,
    ): self {
        return new self($account, Side::Debit, $amount, $leaseId, $partyId, $unitId, $itemType, $itemId);
    }

    public static function credit(
        AccountRole $account,
        Money $amount,
        ?string $leaseId = null,
        ?string $partyId = null,
        ?string $unitId = null,
        ?ItemType $itemType = null,
        ?string $itemId = null,
    ): self {
        return new self($account, Side::Credit, $amount, $leaseId, $partyId, $unitId, $itemType, $itemId);
    }
}

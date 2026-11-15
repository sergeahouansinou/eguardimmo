<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\AccountRole;
use Money\Money;

final readonly class AccountSummaryData
{
    /**
     * @param  list<Money>  $balances  un solde par devise, dans le sens normal du compte
     */
    public function __construct(
        public string $id,
        public string $code,
        public string $label,
        public AccountRole $role,
        public array $balances,
    ) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Banking\Queries;

use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\OrganizationBankAccount;
use Illuminate\Database\Eloquent\Builder;

final class BankAccounts
{
    /**
     * @return Builder<OrganizationBankAccount>
     */
    public function query(): Builder
    {
        return OrganizationBankAccount::query()->addSelect([
            'organization_bank_accounts.*',
            'last_reconciled_on' => BankReconciliation::query()->select('as_of')->whereColumn('bank_account_id', 'organization_bank_accounts.id')
                ->where('status', ReconciliationStatus::Validated)->orderByDesc('as_of')->limit(1),
        ]);
    }
}

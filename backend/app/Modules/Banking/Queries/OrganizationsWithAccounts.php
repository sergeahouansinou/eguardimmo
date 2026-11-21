<?php

declare(strict_types=1);

namespace App\Modules\Banking\Queries;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Shared\Tenancy\AcrossOrganizations;

final class OrganizationsWithAccounts
{
    /**
     * @return list<string>
     */
    public function ids(): array
    {
        return array_values(AcrossOrganizations::query(OrganizationBankAccount::class)
            ->where('status', AccountStatus::Active)->distinct()->orderBy('organization_id')->pluck('organization_id')->all());
    }
}

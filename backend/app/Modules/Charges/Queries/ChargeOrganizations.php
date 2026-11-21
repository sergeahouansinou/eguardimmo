<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\Expense;
use App\Shared\Tenancy\AcrossOrganizations;

/**
 * Organisations qui ont des dépenses ou des décomptes : le périmètre des contrôles planifiés.
 */
final class ChargeOrganizations
{
    /**
     * @return list<string>
     */
    public function withActivity(): array
    {
        $ids = [];

        foreach ([Expense::class, ChargeStatement::class] as $modele) {
            foreach (AcrossOrganizations::query($modele)->distinct()->pluck('organization_id') as $id) {
                $ids[(string) $id] = true;
            }
        }

        $ids = array_keys($ids);
        sort($ids);

        return $ids;
    }
}

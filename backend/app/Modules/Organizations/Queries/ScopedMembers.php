<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Organizations\Data\ScopedMemberData;
use App\Modules\Organizations\Enums\ScopeType;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\AcrossOrganizations;

final class ScopedMembers
{
    /**
     * @return list<ScopedMemberData>
     */
    public function all(): array
    {
        return array_values(AcrossOrganizations::query(OrganizationMember::class)
            ->where('scope_type', ScopeType::Selected)
            ->orderBy('organization_id')
            ->orderBy('id')
            ->get()
            ->map(fn (OrganizationMember $membre): ScopedMemberData => new ScopedMemberData(
                $membre->organization_id,
                $membre->id,
                $membre->role,
                $membre->status,
                count($membre->scope_property_ids ?? []),
            ))
            ->all());
    }
}

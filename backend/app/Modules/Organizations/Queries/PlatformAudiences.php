<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\AcrossOrganizations;

/**
 * Membres actifs des organisations d'un genre, pour les campagnes de la plateforme (ADR 0042).
 */
final class PlatformAudiences
{
    /**
     * @return iterable<string>
     */
    public function members(OrganizationKind $genre): iterable
    {
        $membres = AcrossOrganizations::query(OrganizationMember::class)
            ->where('status', MemberStatus::Active->value)
            ->whereNotNull('user_id')
            ->whereIn('organization_id', Organization::query()->where('kind', $genre->value)->select('id'))
            ->select('user_id');

        return User::query()->whereIn('id', $membres)->select('id')->lazyById(1000)->map(fn (User $compte): string => $compte->id);
    }
}

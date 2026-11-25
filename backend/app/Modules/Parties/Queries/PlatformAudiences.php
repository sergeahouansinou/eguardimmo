<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;

/**
 * Comptes rattachés à une fiche vivante, pour les campagnes de la plateforme (ADR 0042).
 */
final class PlatformAudiences
{
    /**
     * @return iterable<string>
     */
    public function tenants(): iterable
    {
        return $this->ids(AcrossOrganizations::query(Party::class)->whereNotNull('user_id')->whereNull('anonymized_at')->select('user_id'));
    }

    /**
     * @return iterable<string>
     */
    public function owners(): iterable
    {
        return $this->ids(AcrossOrganizations::query(OwnerAccess::class)
            ->where('status', OwnerAccessStatus::Active->value)
            ->whereIn('mandant_party_id', AcrossOrganizations::query(Party::class)->whereNull('anonymized_at')->select('id'))
            ->select('user_id'));
    }

    /**
     * @param  Builder<Party>|Builder<OwnerAccess>  $rattachements
     * @return iterable<string>
     */
    private function ids(Builder $rattachements): iterable
    {
        return User::query()->whereIn('id', $rattachements)->select('id')->lazyById(1000)->map(fn (User $compte): string => $compte->id);
    }
}

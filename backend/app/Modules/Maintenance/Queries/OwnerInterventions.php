<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Interventions que le mandant lit : celles de son mandant, par couple (organisation, mandant) de `MandateDirectory::ownerScope()`.
 * Un signalement non qualifié ou classé sans suite relève du tri de l'équipe et n'existe pas pour lui (ADR 0029, 0032).
 */
final readonly class OwnerInterventions
{
    /**
     * @return CursorPaginator<int, Intervention>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($portee)->orderByDesc('id')->cursorPaginate($parPage, cursor: $curseur);
    }

    public function find(OwnerScopeData $portee, string $id): ?Intervention
    {
        return Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;
    }

    /**
     * @return Builder<Intervention>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        return $portee->restrictToMandants(AcrossOrganizations::query(Intervention::class), 'organization_id', 'mandant_party_id')
            ->whereNotIn('status', [InterventionStatus::Reported->value, InterventionStatus::Declined->value]);
    }
}

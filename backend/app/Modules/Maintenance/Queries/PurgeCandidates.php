<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final readonly class PurgeCandidates
{
    /**
     * Organisations qui ont un signalement de locataire (photos à purger ou texte à effacer).
     *
     * @return list<string>
     */
    public function organizations(CarbonImmutable $today): array
    {
        return array_values(array_map(strval(...), AcrossOrganizations::query(Intervention::class)
            ->where('origin', 'tenant')->distinct()->orderBy('organization_id')->pluck('organization_id')->all()));
    }

    /**
     * @return list<string>
     */
    public function withInterventions(): array
    {
        return array_values(array_map(strval(...), AcrossOrganizations::query(Intervention::class)->distinct()->orderBy('organization_id')->pluck('organization_id')->all()));
    }

    /**
     * Sous le contexte d'une organisation : photos du locataire d'une intervention terminée avant `$limite`.
     *
     * @return Collection<int, InterventionFile>
     */
    public function dueFiles(CarbonImmutable $limite): Collection
    {
        $ids = Intervention::query()
            ->whereIn('status', [InterventionStatus::Closed->value, InterventionStatus::Declined->value, InterventionStatus::Cancelled->value])
            ->whereRaw('COALESCE(closed_at, updated_at) < ?', [$limite->format('Y-m-d H:i:s.u')])
            ->pluck('id');

        return InterventionFile::query()->whereIn('intervention_id', $ids)
            ->where('uploaded_by_kind', ActorKind::Tenant->value)->whereIn('kind', [FileKind::PhotoBefore->value, FileKind::PhotoAfter->value])
            ->orderBy('id')->limit(500)->get();
    }

    /**
     * Sous le contexte d'une organisation.
     *
     * @return list<string>
     */
    public function reporters(): array
    {
        return array_values(array_map(strval(...), Intervention::query()->whereNotNull('reporter_party_id')->where('description', '<>', '[effacé]')
            ->distinct()->pluck('reporter_party_id')->all()));
    }
}

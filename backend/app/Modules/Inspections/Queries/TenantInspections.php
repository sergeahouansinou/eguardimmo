<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Queries;

use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Models\InspectionRemark;
use App\Modules\Inspections\Models\InspectionRemarkFile;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Lectures de l'espace locataire par la clé de l'ADR 0024 : un état publié d'un bail que le compte peut lire ; les remarques,
 * seulement celles de sa propre fiche (confidentialité entre colocataires).
 */
final readonly class TenantInspections
{
    public function __construct(private LeaseDirectory $baux) {}

    /**
     * @return CursorPaginator<int, Inspection>
     */
    public function page(string $userId, int $parPage, ?string $curseur, CarbonImmutable $today): CursorPaginator
    {
        $baux = array_map(fn ($cle): string => $cle->leaseId, $this->baux->visibleToTenant($userId, $today));

        return AcrossOrganizations::query(Inspection::class)
            ->whereIn('lease_id', $baux === [] ? [''] : $baux)
            ->whereNotNull('published_at')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @return array{inspection: Inspection, position: TenantStandingData}|null
     */
    public function find(string $userId, string $id, CarbonImmutable $today): ?array
    {
        $etat = Str::isUuid($id) ? AcrossOrganizations::query(Inspection::class)->whereKey($id)->whereNotNull('published_at')->first() : null;

        return $etat === null ? null : $this->withPosition($userId, $etat, $today);
    }

    /**
     * @return CursorPaginator<int, InspectionRemark>
     */
    public function remarks(TenantStandingData $position, Inspection $etat, int $parPage, ?string $curseur): CursorPaginator
    {
        $page = AcrossOrganizations::query(InspectionRemark::class)
            ->where('organization_id', $position->organizationId)
            ->where('inspection_id', $etat->id)
            ->where('party_id', $position->partyId)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));

        $fichiers = AcrossOrganizations::query(InspectionRemarkFile::class)
            ->where('organization_id', $position->organizationId)
            ->whereIn('remark_id', array_map(fn (InspectionRemark $r): string => $r->id, $page->items()))
            ->orderBy('position')
            ->get()
            ->groupBy('remark_id');

        foreach ($page->items() as $remarque) {
            $remarque->setRelation('files', new EloquentCollection($fichiers->get($remarque->id, collect())->all()));
        }

        return $page;
    }

    /**
     * @return array{file: InspectionRemarkFile, position: TenantStandingData}|null
     */
    public function findFile(string $userId, string $id, CarbonImmutable $today): ?array
    {
        $fichier = Str::isUuid($id) ? AcrossOrganizations::query(InspectionRemarkFile::class)->find($id) : null;
        $remarque = $fichier === null ? null : AcrossOrganizations::query(InspectionRemark::class)->where('organization_id', $fichier->organization_id)->find($fichier->remark_id);
        $etat = $remarque === null ? null : AcrossOrganizations::query(Inspection::class)->where('organization_id', $remarque->organization_id)->whereNotNull('published_at')->find($remarque->inspection_id);
        $trouve = $etat === null ? null : $this->withPosition($userId, $etat, $today);

        return $fichier === null || $remarque === null || $trouve === null || $trouve['position']->partyId !== $remarque->party_id ? null : ['file' => $fichier, 'position' => $trouve['position']];
    }

    /**
     * @return array{inspection: Inspection, position: TenantStandingData}|null
     */
    private function withPosition(string $userId, Inspection $etat, CarbonImmutable $today): ?array
    {
        $position = $this->baux->tenantStanding($userId, $etat->lease_id, $today);

        return $position === null || $position->organizationId !== $etat->organization_id ? null : ['inspection' => $etat, 'position' => $position];
    }
}

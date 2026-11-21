<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Demandes de congé d'un compte : seulement les siennes, sur les baux que sa clé lui montre encore (ADR 0036, invariants 1 et 2).
 */
final readonly class TenantNoticeRequests
{
    public function __construct(
        private TenantLeases $baux,
        private TenantStandings $positions,
    ) {}

    /**
     * @return CursorPaginator<int, LeaseNoticeRequest>
     */
    public function page(string $userId, int $parPage, ?string $curseur, CarbonImmutable $today): CursorPaginator
    {
        $baux = array_map(fn ($cle): string => $cle->leaseId, $this->baux->keys($userId, $today));
        $parties = array_merge(...array_values($this->baux->partiesByOrganization($userId)));

        return AcrossOrganizations::query(LeaseNoticeRequest::class)
            ->whereIn('lease_id', $baux === [] ? [''] : $baux)
            ->whereIn('party_id', $parties === [] ? [''] : $parties)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function find(string $userId, string $id, CarbonImmutable $today): ?LeaseNoticeRequest
    {
        $demande = Str::isUuid($id) ? AcrossOrganizations::query(LeaseNoticeRequest::class)->whereKey($id)->first() : null;

        if ($demande === null) {
            return null;
        }

        $position = $this->positions->find($userId, $demande->lease_id, $today);

        return $position !== null && $position->organizationId === $demande->organization_id && $position->partyId === $demande->party_id ? $demande : null;
    }
}

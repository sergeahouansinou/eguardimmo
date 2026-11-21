<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Models\LeaseDocument;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Pièces que l'agence partage avec le locataire : jamais une pièce dont le partage est retiré, ni celle adressée à un autre colocataire, ni celle partagée à partir du jour où sa propre ligne a pris fin.
 */
final readonly class TenantLeaseDocuments
{
    /**
     * @return CursorPaginator<int, LeaseDocument>
     */
    public function page(TenantStandingData $position, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($position)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function find(TenantStandingData $position, string $id): ?LeaseDocument
    {
        return Str::isUuid($id) ? $this->visible($position)->whereKey($id)->first() : null;
    }

    /**
     * @return Builder<LeaseDocument>
     */
    private function visible(TenantStandingData $position): Builder
    {
        return AcrossOrganizations::query(LeaseDocument::class)
            ->where('organization_id', $position->organizationId)
            ->where('lease_id', $position->leaseId)
            ->whereNull('revoked_at')
            ->where(fn (Builder $q) => $q->whereNull('party_id')->orWhere('party_id', $position->partyId))
            ->when($position->exitedOn !== null, fn (Builder $q) => $q->where('shared_at', '<', (string) $position->exitedOn));
    }
}

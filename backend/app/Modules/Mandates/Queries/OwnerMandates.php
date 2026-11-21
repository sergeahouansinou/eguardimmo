<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Mandats des mandants lisibles du compte, toutes organisations confondues (ADR 0006, 0032) : un brouillon et un mandat archivé
 * n'existent pas pour le propriétaire.
 */
final readonly class OwnerMandates
{
    /**
     * @return CursorPaginator<int, Mandate>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($portee)->orderByDesc('id')->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function find(OwnerScopeData $portee, string $id): ?Mandate
    {
        return Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;
    }

    /**
     * @return Builder<Mandate>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        return $portee->restrictToMandants(AcrossOrganizations::query(Mandate::class), 'organization_id', 'mandant_party_id')
            ->whereNull('archived_at')
            ->where('status', '<>', MandateStatus::Draft->value);
    }
}

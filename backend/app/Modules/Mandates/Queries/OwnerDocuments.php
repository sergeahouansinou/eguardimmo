<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateDocument;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Pièces que l'agence partage avec le mandant : jamais une pièce non partagée ni dont le partage est retiré.
 */
final readonly class OwnerDocuments
{
    /**
     * @return CursorPaginator<int, MandateDocument>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($portee)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function find(OwnerScopeData $portee, string $id): ?MandateDocument
    {
        return Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;
    }

    /**
     * @return Builder<MandateDocument>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        return AcrossOrganizations::query(MandateDocument::class)
            ->whereNotNull('shared_at')
            ->whereNull('revoked_at')
            ->whereExists(fn (QueryBuilder $mandat) => $portee->restrictToMandants(
                $mandat->selectRaw('1')->from('mandates')
                    ->whereColumn('mandates.id', 'mandate_documents.mandate_id')
                    ->whereColumn('mandates.organization_id', 'mandate_documents.organization_id')
                    ->whereNull('mandates.archived_at')
                    ->where('mandates.status', '<>', MandateStatus::Draft->value),
                'mandates.organization_id',
                'mandates.mandant_party_id',
            ));
    }
}

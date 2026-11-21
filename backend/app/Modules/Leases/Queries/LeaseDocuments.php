<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\LeaseDocument;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Vue de l'équipe, sous le contexte de son organisation : pièces partagées, retirées comprises.
 */
final readonly class LeaseDocuments
{
    /**
     * @return CursorPaginator<int, LeaseDocument>
     */
    public function page(string $leaseId, int $parPage, ?string $curseur): CursorPaginator
    {
        return LeaseDocument::query()
            ->where('lease_id', $leaseId)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $leaseId, string $id): LeaseDocument
    {
        return (Str::isUuid($id) ? LeaseDocument::query()->where('lease_id', $leaseId)->whereKey($id)->first() : null) ?? throw ErrorCode::LeaseDocumentNotFound->problem();
    }
}

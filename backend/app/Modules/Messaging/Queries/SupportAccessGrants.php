<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Les accès du support vus d'une organisation : celle-ci ne voit que les siens, un accès d'une autre répond 404.
 */
final class SupportAccessGrants
{
    /**
     * @return CursorPaginator<int, SupportAccessGrant>
     */
    public function page(string $organisationId, ?SupportAccessStatus $statut, ?string $curseur, int $parPage): CursorPaginator
    {
        return SupportAccessGrant::query()
            ->where('organization_id', $organisationId)
            ->when($statut !== null, fn ($q) => $q->where('status', $statut))
            ->with(['ticket:id,reference', 'operator'])
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function find(string $organisationId, string $id): SupportAccessGrant
    {
        $acces = Str::isUuid($id)
            ? SupportAccessGrant::query()->where('organization_id', $organisationId)->with(['ticket:id,reference', 'operator'])->find($id)
            : null;

        return $acces ?? throw ErrorCode::SupportAccessNotFound->problem();
    }
}

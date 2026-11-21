<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Vue de l'équipe, sous le contexte de son organisation.
 */
final readonly class NoticeRequests
{
    /**
     * @return CursorPaginator<int, LeaseNoticeRequest>
     */
    public function page(?NoticeRequestStatus $statut, int $parPage, ?string $curseur): CursorPaginator
    {
        return LeaseNoticeRequest::query()
            ->when($statut !== null, fn ($q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): LeaseNoticeRequest
    {
        return (Str::isUuid($id) ? LeaseNoticeRequest::query()->find($id) : null) ?? throw ErrorCode::NoticeRequestNotFound->problem();
    }
}

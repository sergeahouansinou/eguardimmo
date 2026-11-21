<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Models\RentReceipt;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class ReceiptList
{
    /**
     * @return CursorPaginator<int, RentReceipt>
     */
    public function list(?string $leaseId, ?string $cursor, int $parPage): CursorPaginator
    {
        return RentReceipt::query()
            ->when($leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $leaseId))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $cursor === null ? null : Cursor::fromEncoded($cursor));
    }
}

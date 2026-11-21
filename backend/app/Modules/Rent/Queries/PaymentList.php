<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class PaymentList
{
    /**
     * @return CursorPaginator<int, Payment>
     */
    public function list(?string $leaseId, ?PaymentStatus $status, ?string $cursor, int $parPage): CursorPaginator
    {
        return Payment::query()
            ->with('allocations')
            ->when($leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $leaseId))
            ->when($status !== null, fn (Builder $q) => $q->where('status', $status?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $cursor === null ? null : Cursor::fromEncoded($cursor));
    }
}

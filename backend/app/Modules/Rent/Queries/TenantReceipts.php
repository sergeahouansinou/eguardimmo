<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\RentReceipt;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Quittances des baux visibles du locataire, annulées comprises : elles se signalent (`is_void`) au lieu de disparaître.
 */
final readonly class TenantReceipts
{
    public function __construct(private TenantRentScope $portee) {}

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return CursorPaginator<int, RentReceipt>
     */
    public function page(array $cles, ?string $leaseId, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visible($cles)
            ->when($leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $leaseId))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function get(array $cles, string $id): RentReceipt
    {
        return (Str::isUuid($id) ? $this->visible($cles)->whereKey($id)->first() : null) ?? throw ErrorCode::ReceiptNotFound->problem('Cette quittance est introuvable.');
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return Builder<RentReceipt>
     */
    private function visible(array $cles): Builder
    {
        return $this->portee->restrict(AcrossOrganizations::query(RentReceipt::class), $cles);
    }
}

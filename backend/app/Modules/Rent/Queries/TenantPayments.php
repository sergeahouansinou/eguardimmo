<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Models\Payment;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Encaissements des baux visibles du locataire : le bail est solidaire, le paiement d'un colocataire s'impute sur la même dette.
 */
final readonly class TenantPayments
{
    public function __construct(private TenantRentScope $portee) {}

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return CursorPaginator<int, Payment>
     */
    public function page(array $cles, ?string $leaseId, ?PaymentStatus $statut, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visible($cles)
            ->when($leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $leaseId))
            ->when($statut !== null, fn (Builder $q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function get(array $cles, string $id): Payment
    {
        return (Str::isUuid($id) ? $this->visible($cles)->whereKey($id)->first() : null) ?? throw ErrorCode::PaymentNotFound->problem('Cet encaissement est introuvable.');
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return Builder<Payment>
     */
    private function visible(array $cles): Builder
    {
        return $this->portee->restrict(AcrossOrganizations::query(Payment::class), $cles);
    }
}

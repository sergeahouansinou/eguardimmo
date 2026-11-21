<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Vue de l'équipe, sous le contexte de son organisation.
 */
final readonly class InsuranceSubmissions
{
    /**
     * @return CursorPaginator<int, LeaseInsuranceSubmission>
     */
    public function page(?InsuranceSubmissionStatus $statut, int $parPage, ?string $curseur): CursorPaginator
    {
        return LeaseInsuranceSubmission::query()
            ->when($statut !== null, fn ($q) => $q->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): LeaseInsuranceSubmission
    {
        return (Str::isUuid($id) ? LeaseInsuranceSubmission::query()->find($id) : null) ?? throw ErrorCode::InsuranceSubmissionNotFound->problem();
    }

    /**
     * @return Collection<int, LeaseInsuranceSubmission>
     */
    public function ofLease(string $leaseId): Collection
    {
        return LeaseInsuranceSubmission::query()->where('lease_id', $leaseId)->orderByDesc('id')->limit(TenantInsuranceSubmissions::MAX)->get();
    }
}

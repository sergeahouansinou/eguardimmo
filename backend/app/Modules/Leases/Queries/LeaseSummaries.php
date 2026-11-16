<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\Data\OccupancyData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseOccupancy;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class LeaseSummaries
{
    public const int MAX_PAGE = 500;

    public function __construct(
        private CurrentOrganization $organisation,
        private Leases $baux,
    ) {}

    public function bail(string $id): Lease
    {
        $this->organisation->id();

        return $this->baux->get($id);
    }

    public function one(string $id): LeaseData
    {
        $bail = $this->bail($id);
        $bail->load('units');

        return $this->toData($bail);
    }

    /**
     * @param  list<string>  $ids
     * @return list<LeaseData>
     */
    public function many(array $ids): array
    {
        $this->organisation->id();
        $ids = array_values(array_unique($ids));

        if ($ids === []) {
            return [];
        }

        if (array_filter($ids, fn (string $id): bool => ! Str::isUuid($id)) !== []) {
            throw ErrorCode::LeaseNotFound->problem();
        }

        $baux = Lease::query()->with('units')->whereIn('id', $ids)->get()->keyBy('id');

        return array_map(fn (string $id): LeaseData => $this->toData($baux->get($id) ?? throw ErrorCode::LeaseNotFound->problem()), $ids);
    }

    public function billing(string $id): LeaseBillingData
    {
        return $this->toBilling($this->bail($id));
    }

    /**
     * @return list<LeaseBillingData>
     */
    public function activeBetween(CarbonImmutable $from, CarbonImmutable $to, ?string $afterId, int $limit): array
    {
        $this->organisation->id();

        if ($to->lessThan($from)) {
            throw ErrorCode::LeasePeriodInvalid->problem();
        }

        if ($afterId !== null && ! Str::isUuid($afterId)) {
            throw ErrorCode::LeaseNotFound->problem();
        }

        $debut = $from->toDateString();

        return array_values(Lease::query()
            ->tap(fn (Builder $q) => LeaseOccupancy::between($q, $debut, $to->toDateString()))
            ->when($afterId !== null, fn (Builder $q) => $q->where('id', '>', (string) $afterId))
            ->orderBy('id')
            ->limit(max(1, min($limit, self::MAX_PAGE)))
            ->get()
            ->map(fn (Lease $bail): LeaseBillingData => $this->toBilling($bail))
            ->all());
    }

    /**
     * @param  list<string>  $unitIds
     * @return list<OccupancyData>
     */
    public function occupancyAt(array $unitIds, CarbonImmutable $date): array
    {
        $this->organisation->id();
        $unitIds = array_values(array_unique($unitIds));

        if ($unitIds === []) {
            return [];
        }

        $jour = $date->toDateString();

        return array_values(LeaseUnit::query()
            ->with('lease')
            ->whereIn('unit_id', $unitIds)
            ->where('valid_from', '<=', $jour)
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
            ->whereHas('lease', fn (Builder $q) => LeaseOccupancy::between($q, $jour))
            ->orderBy('unit_id')
            ->orderBy('valid_from')
            ->orderBy('id')
            ->get()
            ->map(fn (LeaseUnit $ligne): OccupancyData => new OccupancyData(
                unitId: $ligne->unit_id,
                leaseId: $ligne->lease_id,
                leaseReference: $ligne->lease->reference,
                isMain: $ligne->is_main,
                validFrom: $ligne->valid_from->toDateString(),
                validTo: $ligne->valid_to?->toDateString(),
            ))
            ->all());
    }

    private function toBilling(Lease $bail): LeaseBillingData
    {
        return new LeaseBillingData(
            leaseId: $bail->id,
            reference: $bail->reference,
            status: $bail->status,
            dueDay: $bail->due_day,
            periodicity: $bail->periodicity,
            billingTiming: $bail->billing_timing,
            currency: $bail->currency,
            startsOn: $bail->starts_on->toDateString(),
            effectiveEndsOn: $bail->effectiveEnd(),
        );
    }

    private function toData(Lease $bail): LeaseData
    {
        $lots = $bail->units->sortBy([['is_main', 'desc'], ['valid_from', 'asc'], ['id', 'asc']])->values();

        return new LeaseData(
            id: $bail->id,
            reference: $bail->reference,
            jurisdiction: $bail->jurisdiction,
            regimeKey: $bail->regime_key,
            status: $bail->status,
            startsOn: $bail->starts_on->toDateString(),
            endsOn: $bail->ends_on?->toDateString(),
            noticeDepartureOn: $bail->notice_departure_on?->toDateString(),
            signedOn: $bail->signed_on?->toDateString(),
            dueDay: $bail->due_day,
            periodicity: $bail->periodicity,
            billingTiming: $bail->billing_timing,
            currency: $bail->currency,
            isArchived: $bail->archived_at !== null,
            units: array_values($lots->map(fn (LeaseUnit $ligne): LeaseUnitData => new LeaseUnitData(
                unitId: $ligne->unit_id,
                isMain: $ligne->is_main,
                validFrom: $ligne->valid_from->toDateString(),
                validTo: $ligne->valid_to?->toDateString(),
            ))->all()),
        );
    }
}

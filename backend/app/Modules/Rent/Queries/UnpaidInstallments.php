<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Data\UnpaidInstallmentData;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Support\Settlement;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

final readonly class UnpaidInstallments
{
    public const int MAX_PAGE = 500;

    public function __construct(
        private CurrentOrganization $organisation,
        private Settlement $reglement,
    ) {}

    /**
     * Échéances appelées, non soldées, dont la date est dépassée à $asOf (jour compris : échue le jour même ne l'est pas),
     * par identifiant croissant. $leaseId limite à un bail.
     *
     * @return list<UnpaidInstallmentData>
     */
    public function overdue(CarbonImmutable $asOf, ?string $leaseId, ?string $afterId, int $limit): array
    {
        $this->organisation->id();

        $echeances = Installment::query()
            ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, InstallmentStatus::open()))
            ->where('due_date', '<', $asOf->toDateString())
            ->when($leaseId !== null, fn ($q) => $q->where('lease_id', (string) $leaseId))
            ->when($afterId !== null && Str::isUuid($afterId), fn ($q) => $q->where('id', '>', (string) $afterId))
            ->orderBy('id')
            ->limit(max(1, min($limit, self::MAX_PAGE)))
            ->get();
        $restes = $this->reglement->outstanding(array_values($echeances->all()));

        return array_values($echeances->map(fn (Installment $e): UnpaidInstallmentData => new UnpaidInstallmentData(
            $e->id,
            $e->lease_id,
            $e->party_id,
            $e->period_start->toDateString(),
            $e->period_end->toDateString(),
            $e->due_date->toDateString(),
            $e->status,
            $e->total_amount,
            $restes[$e->id],
        ))->all());
    }
}

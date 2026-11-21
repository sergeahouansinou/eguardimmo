<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\MandateFeeScheduleData;
use App\Modules\Mandates\Data\MandateFeeTermData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;

/**
 * Mandats sortis du brouillon, avec leurs lots et leurs barèmes successifs, pour le calcul des honoraires.
 */
final readonly class FeeSchedules
{
    /**
     * @param  string  $until  dernier jour de la période de calcul, inclus : les mandats commencés après sont ignorés
     * @param  string|null  $mandateId  restreint à ce mandat (lecture ciblée)
     * @return list<MandateFeeScheduleData>
     */
    public function until(string $until, ?string $mandateId = null): array
    {
        $mandats = Mandate::query()
            ->where('status', '<>', MandateStatus::Draft->value)
            ->where('starts_on', '<=', $until)
            ->when($mandateId !== null, fn ($requete) => $requete->whereKey($mandateId))
            ->orderBy('starts_on')->orderBy('id')
            ->get();

        if ($mandats->isEmpty()) {
            return [];
        }

        $ids = $mandats->modelKeys();
        $lots = MandateUnit::query()->whereIn('mandate_id', $ids)->orderBy('valid_from')->orderBy('id')->get()->groupBy('mandate_id');
        $termes = MandateTerm::query()->whereIn('mandate_id', $ids)->orderBy('valid_from')->orderBy('id')->get()->groupBy('mandate_id');

        return array_values($mandats->map(fn (Mandate $m): MandateFeeScheduleData => new MandateFeeScheduleData(
            $m->id,
            $m->reference,
            $m->mandant_party_id,
            $m->currency,
            $m->starts_on->toDateString(),
            $m->ends_on->toDateString(),
            array_values(($lots->get($m->id) ?? collect())->map(fn (MandateUnit $l): array => [
                'unit_id' => $l->unit_id,
                'valid_from' => $l->valid_from->toDateString(),
                'valid_to' => $l->valid_to?->toDateString(),
            ])->all()),
            array_values(($termes->get($m->id) ?? collect())->map(fn (MandateTerm $t): MandateFeeTermData => new MandateFeeTermData(
                $t->id,
                $t->valid_from->toDateString(),
                $t->valid_to?->toDateString(),
                $t->fee_kind,
                $t->fee_basis_points,
                $t->fee_flat_amount === null ? null : (int) $t->fee_flat_amount->getAmount(),
                $t->fee_base,
                (int) $t->fee_minimum_amount->getAmount(),
                $t->fee_tax_mode,
                $t->payout_day,
            ))->all()),
        ))->all());
    }
}

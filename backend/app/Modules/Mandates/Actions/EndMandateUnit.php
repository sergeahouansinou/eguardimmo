<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\EndMandateUnitData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Queries\Mandates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class EndMandateUnit
{
    public function __construct(private Mandates $mandats) {}

    /**
     * Raccourcit la couverture : elle ne peut que libérer le lot, aucun verrou de lots n'est nécessaire.
     */
    public function handle(Mandate $mandate, string $unitLineId, EndMandateUnitData $donnees): MandateUnit
    {
        return DB::transaction(function () use ($mandate, $unitLineId, $donnees): MandateUnit {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if (! in_array($mandat->status, [MandateStatus::Active, MandateStatus::Suspended], true)) {
                throw ErrorCode::MandateNotRunning->problem();
            }

            $lignes = $mandat->units()->lockForUpdate()->get();
            $ligne = $lignes->first(fn (MandateUnit $l): bool => $l->id === $unitLineId) ?? throw ErrorCode::MandateUnitNotFound->problem();
            $fin = CarbonImmutable::parse($donnees->endDate)->addDay()->toDateString();

            if ($ligne->valid_to !== null || $fin <= $ligne->valid_from->toDateString() || $fin > $mandat->ends_on->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('La fin de couverture doit suivre son début et rester dans le mandat.');
            }

            if ($lignes->filter(fn (MandateUnit $l): bool => $l->valid_to === null && $l->id !== $ligne->id)->isEmpty()) {
                throw ErrorCode::MandateLastUnit->problem();
            }

            $ligne->setAttribute('valid_to', $fin);
            $ligne->save();

            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            return $ligne;
        });
    }
}

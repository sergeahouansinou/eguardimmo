<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\AddMandateUnitData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Support\CoverageGuard;
use App\Modules\Mandates\Support\DraftMandateStructure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class AddMandateUnit
{
    public function __construct(
        private Mandates $mandats,
        private CoverageGuard $garde,
        private DraftMandateStructure $structure,
    ) {}

    /**
     * Sur un mandat en cours, le lot est verrouillé puis comparé aux autres mandats avant toute lecture non verrouillante.
     */
    public function handle(Mandate $mandate, AddMandateUnitData $donnees): MandateUnit
    {
        return DB::transaction(function () use ($mandate, $donnees): MandateUnit {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            $enCours = in_array($mandat->status, [MandateStatus::Active, MandateStatus::Suspended], true);

            if (! $enCours && $mandat->status !== MandateStatus::Draft) {
                throw ErrorCode::MandateNotRunning->problem();
            }

            $existantes = $mandat->units()->lockForUpdate()->get();
            $debut = $donnees->validFrom ?? ($enCours ? max($mandat->starts_on->toDateString(), CarbonImmutable::today()->toDateString()) : $mandat->starts_on->toDateString());

            if ($debut < $mandat->starts_on->toDateString() || $debut >= $mandat->ends_on->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('Le lot doit être couvert pendant la période du mandat.');
            }

            if ($existantes->contains(fn (MandateUnit $l): bool => $l->unit_id === $donnees->unitId && ($l->valid_to === null || $l->valid_to->toDateString() > $debut))) {
                throw ErrorCode::MandateUnitConflict->problem();
            }

            $ligne = new MandateUnit(['mandate_id' => $mandat->id, 'unit_id' => $donnees->unitId, 'valid_from' => $debut]);

            if ($enCours) {
                $this->garde->assertFree($mandat, [$ligne]);
            }

            $this->structure->assertUnitsAvailable([$donnees->unitId]);
            $ligne->save();

            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            return $ligne;
        });
    }
}

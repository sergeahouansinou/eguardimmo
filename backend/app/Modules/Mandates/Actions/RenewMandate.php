<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\RenewMandateData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Support\CoverageGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RenewMandate
{
    public function __construct(
        private Mandates $mandats,
        private CoverageGuard $garde,
        private RecordAudit $audit,
    ) {}

    /**
     * Prolonge la fin du mandat : il se sérialise avec toute activation qui vise les mêmes lots. Mandat et lignes se
     * lisent `FOR UPDATE` avant le verrou des lots.
     */
    public function handle(Mandate $mandate, RenewMandateData $donnees): Mandate
    {
        return DB::transaction(function () use ($mandate, $donnees): Mandate {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if (! in_array($mandat->status, [MandateStatus::Active, MandateStatus::Suspended], true)) {
                throw ErrorCode::MandateRenewalInvalid->problem('Seul un mandat actif ou suspendu se renouvelle : créez un nouveau mandat pour un mandat résilié ou expiré.');
            }

            $ancienne = $mandat->ends_on->toDateString();
            $lignes = array_values($mandat->units()->orderBy('valid_from')->orderBy('id')->lockForUpdate()->get()->all());

            $mandat->setAttribute('ends_on', $mandat->ends_on->addMonthsNoOverflow($donnees->months)->toDateString());
            $ouvertes = array_values(array_filter($lignes, fn (MandateUnit $l): bool => $l->valid_to === null));
            $this->garde->assertFree($mandat, $ouvertes);

            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            $this->audit->handle('mandates.mandate.renewed', subject: $mandat, metadata: [
                'previous_ends_on' => $ancienne,
                'ends_on' => $mandat->ends_on->toDateString(),
                'months' => $donnees->months,
            ]);

            return $mandat;
        });
    }
}

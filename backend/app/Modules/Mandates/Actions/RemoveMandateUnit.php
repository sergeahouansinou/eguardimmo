<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Queries\Mandates;
use Illuminate\Support\Facades\DB;

final readonly class RemoveMandateUnit
{
    public function __construct(private Mandates $mandats) {}

    /**
     * Retire un lot d'un brouillon ; un mandat activé garde la trace de ses lots (voir EndMandateUnit).
     */
    public function handle(Mandate $mandate, string $unitLineId, int $lockVersion): void
    {
        DB::transaction(function () use ($mandate, $unitLineId, $lockVersion): void {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if ($mandat->status !== MandateStatus::Draft) {
                throw ErrorCode::MandateNotDraft->problem();
            }

            $ligne = MandateUnit::query()->where('mandate_id', $mandat->id)->whereKey($unitLineId)->first()
                ?? throw ErrorCode::MandateUnitNotFound->problem();
            $ligne->delete();

            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();
        });
    }
}

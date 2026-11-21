<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Queries\Mandates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ResumeMandate
{
    public function __construct(private Mandates $mandats) {}

    public function handle(Mandate $mandate, int $lockVersion): Mandate
    {
        return DB::transaction(function () use ($mandate, $lockVersion): Mandate {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if ($mandat->status !== MandateStatus::Suspended) {
                throw ErrorCode::MandateNotSuspended->problem();
            }

            if ($mandat->ends_on->toDateString() <= CarbonImmutable::today()->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('Le mandat est échu : renouvelez-le avant de le reprendre.');
            }

            $mandat->status = MandateStatus::Active;
            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            return $mandat;
        });
    }
}

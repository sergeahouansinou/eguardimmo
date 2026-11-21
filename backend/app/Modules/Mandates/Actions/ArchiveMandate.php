<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Queries\Mandates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveMandate
{
    public function __construct(private Mandates $mandats) {}

    public function handle(Mandate $mandate): Mandate
    {
        return DB::transaction(function () use ($mandate): Mandate {
            $courant = $this->mandats->locked($mandate->id);

            if ($courant->archived_at !== null) {
                return $courant;
            }

            $enCours = in_array($courant->status, [MandateStatus::Active, MandateStatus::Suspended], true)
                || ($courant->status === MandateStatus::Terminated && $courant->ends_on->toDateString() > CarbonImmutable::today()->toDateString());

            if ($enCours) {
                throw ErrorCode::MandateNotArchivable->problem();
            }

            $courant->archived_at = now();
            $courant->save();

            return $courant;
        });
    }
}

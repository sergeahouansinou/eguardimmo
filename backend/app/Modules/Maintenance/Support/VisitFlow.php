<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionVisit;
use Illuminate\Support\Str;

final class VisitFlow
{
    public function lock(string $visitId, string $interventionId): InterventionVisit
    {
        return (Str::isUuid($visitId) ? InterventionVisit::query()->whereKey($visitId)->where('intervention_id', $interventionId)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::VisitNotFound->problem();
    }

    /**
     * Sans visite confirmée, une intervention planifiée ou en cours redevient « approuvée ».
     */
    public function fallBack(Intervention $intervention, Transitions $transitions): void
    {
        if (! in_array($intervention->status, [InterventionStatus::Scheduled, InterventionStatus::InProgress], true)) {
            return;
        }

        $reste = InterventionVisit::query()->where('intervention_id', $intervention->id)->where('status', VisitStatus::Confirmed->value)->exists();

        if (! $reste) {
            $transitions->apply($intervention, InterventionStatus::Approved);
        }
    }
}

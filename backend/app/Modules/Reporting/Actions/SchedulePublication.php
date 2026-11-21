<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class SchedulePublication
{
    public function __construct(private MandantLock $verrou, private RecordAudit $audit) {}

    /**
     * Planifie (ou annule la planification de) la publication d'un compte rendu généré : `reporting:publish-scheduled` le
     * publiera à l'échéance, si la période est alors close. Réservé à ceux qui peuvent publier.
     */
    public function handle(ManagementReport $rapport, ?CarbonImmutable $echeance): ManagementReport
    {
        return DB::transaction(function () use ($rapport, $echeance): ManagementReport {
            $this->verrou->acquire($rapport->mandant_party_id);
            $courant = ManagementReport::query()->whereKey($rapport->id)->lockForUpdate()->firstOrFail();

            if ($courant->status !== ReportStatus::Generated) {
                throw $courant->status === ReportStatus::Draft ? ErrorCode::NotGenerated->problem() : ErrorCode::NotEditable->problem();
            }

            $courant->forceFill(['scheduled_for' => $echeance, 'lock_version' => $courant->lock_version + 1])->save();
            $this->audit->handle($echeance === null ? 'reporting.report.unscheduled' : 'reporting.report.scheduled', subject: $courant, metadata: ['scheduled_for' => $echeance?->toIso8601String()]);

            return $courant;
        });
    }
}

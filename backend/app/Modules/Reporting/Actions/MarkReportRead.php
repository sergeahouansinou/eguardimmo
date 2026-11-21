<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\ReportReadMark;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class MarkReportRead
{
    public function __construct(private RecordAudit $audit, private ReportReadMark $marque) {}

    /**
     * Pose `first_read_at` une seule fois, sans suivre la navigation (ADR 0030) ; le rejeu ne change rien et ne journalise rien.
     * Suppose un contexte d'organisation. La mise à jour conditionnelle tient l'idempotence sans verrou, et comme une écriture de
     * masse ne déclenche aucun événement Eloquent, l'audit est écrit ici, dans la même transaction.
     */
    public function handle(ManagementReport $rapport, string $userId): ManagementReport
    {
        return DB::transaction(function () use ($rapport, $userId): ManagementReport {
            if ($this->marque->place($rapport->id)) {
                $this->audit->handle('reporting.report.read', $userId, ['number' => $rapport->number], $rapport);
            }

            return ManagementReport::query()->findOrFail($rapport->id);
        });
    }
}

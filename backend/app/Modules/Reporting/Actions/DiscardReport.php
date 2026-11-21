<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DiscardReport
{
    public function __construct(private MandantLock $verrou, private RecordAudit $audit) {}

    /**
     * Un brouillon ou un compte rendu généré s'abandonne ; la ligne reste (aucune suppression physique) et libère la période.
     */
    public function handle(ManagementReport $rapport): ManagementReport
    {
        return DB::transaction(function () use ($rapport): ManagementReport {
            $this->verrou->acquire($rapport->mandant_party_id);
            $courant = ManagementReport::query()->whereKey($rapport->id)->lockForUpdate()->firstOrFail();

            if (! $courant->status->isEditable()) {
                throw ErrorCode::NotEditable->problem();
            }

            $courant->forceFill(['status' => ReportStatus::Discarded, 'lock_version' => $courant->lock_version + 1])->save();
            $this->audit->handle('reporting.report.discarded', subject: $courant, metadata: ['supersedes_id' => $courant->supersedes_id]);

            return $courant;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class RectifyReport
{
    public function __construct(private MandantLock $verrou, private GenerateReport $generation, private RecordAudit $audit) {}

    /**
     * Rectificatif d'un compte rendu publié : nouveau compte rendu généré sur la même période, avec un motif obligatoire. Il
     * remplace l'original à sa publication ; l'original n'est jamais modifié avant. Un seul rectificatif en cours par original.
     */
    public function handle(ManagementReport $original, string $motif, ?string $userId): ManagementReport
    {
        try {
            return DB::transaction(function () use ($original, $motif, $userId): ManagementReport {
                $this->verrou->acquire($original->mandant_party_id);
                $source = ManagementReport::query()->whereKey($original->id)->lockForUpdate()->firstOrFail();

                if ($source->status !== ReportStatus::Published) {
                    throw ErrorCode::NotEditable->problem('Seul un compte rendu publié et non remplacé se rectifie.');
                }

                $rectificatif = ManagementReport::query()->create([
                    'mandant_party_id' => $source->mandant_party_id,
                    'period_kind' => $source->period_kind,
                    'period_start' => $source->period_start->toDateString(),
                    'period_end' => $source->period_end->toDateString(),
                    'status' => ReportStatus::Draft,
                    'currency' => $source->currency,
                    'content' => $source->content,
                    'options' => $source->options,
                    'notify' => $source->notify,
                    'supersedes_id' => $source->id,
                    'rectification_reason' => $motif,
                    'idempotency_key' => hash('sha256', 'rectification|'.Str::uuid7()),
                    'request_hash' => hash('sha256', $source->id.'|'.$motif),
                    'created_by_user_id' => $userId,
                ]);

                $genere = $this->generation->handle($rectificatif);
                $this->audit->handle('reporting.report.rectified', subject: $genere, metadata: ['supersedes_id' => $source->id, 'reason' => $motif]);

                return $genere;
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::NotEditable->problem('Un rectificatif est déjà en cours pour ce compte rendu.');
        }
    }
}

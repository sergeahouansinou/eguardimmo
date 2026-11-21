<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use App\Modules\Reporting\Support\Own\ReportLines;
use App\Modules\Reporting\Support\ReportComputer;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class GenerateReport
{
    public function __construct(
        private ReportComputer $calcul,
        private ReportLines $lignes,
        private MandantLock $verrou,
        private RecordAudit $audit,
    ) {}

    /**
     * Fige les chiffres du grand livre dans le brouillon ou régénère un compte rendu déjà généré ; l'appelant a vérifié la
     * version. Ne touche jamais un compte rendu publié.
     */
    public function handle(ManagementReport $rapport): ManagementReport
    {
        return DB::transaction(function () use ($rapport): ManagementReport {
            $this->verrou->acquire($rapport->mandant_party_id);
            $courant = ManagementReport::query()->whereKey($rapport->id)->lockForUpdate()->firstOrFail();

            if (! $courant->status->isEditable()) {
                throw ErrorCode::NotEditable->problem();
            }

            $contenu = $courant->content;
            $sections = is_array($contenu['sections'] ?? null) ? array_values(array_map(strval(...), $contenu['sections'])) : [];
            $calcule = $this->calcul->compute($courant->mandant_party_id, $courant->period(), $sections, $courant->options);
            $chiffres = $calcule->figures;

            $this->lignes->replace($courant, $chiffres->lines);
            $courant->forceFill([
                'status' => ReportStatus::Generated,
                'opening_balance' => $chiffres->opening,
                'collected_total' => $chiffres->collected,
                'fees_total' => $chiffres->fees,
                'works_total' => $chiffres->works,
                'payout_total' => $chiffres->payout,
                'adjustments_total' => $chiffres->adjustments,
                'closing_balance' => $chiffres->closing,
                'snapshot' => $calcule->snapshot,
                'ledger_cutoff' => $calcule->cutoff,
                'fingerprint' => $calcule->fingerprint,
                'template_version' => $calcule->templateVersion,
                'generated_at' => CarbonImmutable::now(),
                'lock_version' => $courant->lock_version + 1,
            ])->save();
            $this->audit->handle('reporting.report.generated', subject: $courant, metadata: ['fingerprint' => $calcule->fingerprint, 'lines' => count($chiffres->lines)]);

            return $courant;
        });
    }
}

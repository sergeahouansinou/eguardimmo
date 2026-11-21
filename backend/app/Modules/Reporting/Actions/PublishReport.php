<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Events\ManagementReportPublished;
use App\Modules\Reporting\Jurisdictions\ManagementReportJurisdictions;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use App\Modules\Reporting\Support\Own\ReportNumbers;
use App\Modules\Reporting\Support\PdfRenderer;
use App\Modules\Reporting\Support\ReportComputer;
use App\Modules\Reporting\Support\ReportHtml;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class PublishReport
{
    public function __construct(
        private MandantLock $verrou,
        private LedgerAggregates $grandLivre,
        private ReportComputer $calcul,
        private ReportNumbers $numeros,
        private ReportHtml $html,
        private PdfRenderer $pdf,
        private IssuedDocuments $documents,
        private OrganizationDirectory $organisations,
        private ManagementReportJurisdictions $juridictions,
        private RecordAudit $audit,
    ) {}

    /**
     * Publication : période close, chiffres identiques au recalcul, numéro continu, PDF stocké et scellé, puis immuable. Tout
     * échec (dont Gotenberg) annule la transaction : ni numéro consommé ni pièce. Rejouable : un compte rendu déjà publié
     * est renvoyé tel quel.
     */
    public function handle(ManagementReport $rapport, ?string $userId, CarbonImmutable $today): ManagementReport
    {
        return DB::transaction(function () use ($rapport, $userId, $today): ManagementReport {
            $this->verrou->acquire($rapport->mandant_party_id);
            $courant = ManagementReport::query()->whereKey($rapport->id)->lockForUpdate()->firstOrFail();

            if ($courant->status === ReportStatus::Published) {
                return $courant;
            }

            if ($courant->status === ReportStatus::Draft) {
                throw ErrorCode::NotGenerated->problem();
            }

            if ($courant->status !== ReportStatus::Generated) {
                throw ErrorCode::NotPublishable->problem();
            }

            $periode = $courant->period();
            $closJusqua = $this->grandLivre->closedThrough();

            if ($closJusqua === null || $closJusqua->lessThan($periode->to)) {
                throw ErrorCode::PeriodNotClosed->problem();
            }

            $contenu = $courant->content;
            $sections = is_array($contenu['sections'] ?? null) ? array_values(array_map(strval(...), $contenu['sections'])) : [];
            $recalcule = $this->calcul->compute($courant->mandant_party_id, $periode, $sections, $courant->options);

            if (! hash_equals((string) $courant->fingerprint, $recalcule->fingerprint)) {
                throw ErrorCode::StaleVersion->problem('Les chiffres du grand livre ont changé depuis la génération : régénérez le compte rendu et relisez-le.');
            }

            $regles = $this->juridictions->for($this->organisations->country());
            $numero = $this->numeros->next($regles, $today);
            $original = $courant->supersedes_id === null ? null : ManagementReport::query()->whereKey($courant->supersedes_id)->lockForUpdate()->firstOrFail();
            $instantane = [
                ...($courant->snapshot ?? []),
                'number' => $numero,
                'published_on' => $today->toDateString(),
                'rectifies_number' => $original?->number,
                'rectification_reason' => $courant->rectification_reason,
            ];
            $pdf = $this->pdf->render($this->html->render($instantane));

            $piece = $this->documents->issue(new NewIssuedDocumentData(
                IssuedDocumentType::ManagementReport,
                $instantane,
                (string) $courant->template_version,
                FileSource::contents($pdf),
                "compte-rendu-{$numero}.pdf",
                new DocumentSubject('management_report', $courant->id),
                $today->addYears($regles->retentionYears()),
            ));

            $courant->forceFill([
                'status' => ReportStatus::Published,
                'number' => $numero,
                'snapshot' => $instantane,
                'issued_document_id' => $piece->id,
                'stored_file_id' => $piece->file->id,
                'published_at' => CarbonImmutable::now(),
                'published_by_user_id' => $userId,
                'scheduled_for' => null,
                'lock_version' => $courant->lock_version + 1,
            ])->save();

            $original?->forceFill(['status' => ReportStatus::Superseded, 'lock_version' => $original->lock_version + 1])->save();

            $this->audit->handle('reporting.report.published', subject: $courant, metadata: [
                'number' => $numero,
                'mandant_party_id' => $courant->mandant_party_id,
                'period_start' => $periode->from->toDateString(),
                'period_end' => $periode->to->toDateString(),
                'fingerprint' => $courant->fingerprint,
                'supersedes_id' => $courant->supersedes_id,
                'scheduled' => $userId === null,
            ]);

            ManagementReportPublished::dispatch($courant->id, $courant->organization_id, $courant->mandant_party_id, $courant->notify, $original !== null);

            return $courant;
        });
    }
}

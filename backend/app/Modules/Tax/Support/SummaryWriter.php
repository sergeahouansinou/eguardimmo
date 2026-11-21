<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Tax\Data\NewSummaryData;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Models\TaxSummaryLine;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Fige une synthèse : PDF d'abord (une panne de Gotenberg n'écrit rien), pièce émise, puis la synthèse et ses lignes en ajout seul.
 * À appeler dans la transaction de l'appelant.
 */
final readonly class SummaryWriter
{
    public function __construct(private SummaryHtml $html, private SummaryPdf $pdf, private IssuedDocuments $documents) {}

    public function write(NewSummaryData $nouvelle): TaxSummary
    {
        $id = (string) Str::uuid7();
        $instantane = $nouvelle->income->toSnapshot();
        $empreinte = $nouvelle->income->fingerprint();
        $annee = $nouvelle->income->incomeYear;
        $pdf = $this->pdf->render($this->html->render($instantane, substr($empreinte, 0, 12), $nouvelle->holderName));

        $piece = $this->documents->issue(new NewIssuedDocumentData(
            IssuedDocumentType::TaxSummary,
            $instantane,
            $nouvelle->income->templateVersion,
            FileSource::contents($pdf),
            "synthese-revenus-fonciers-{$annee}.pdf",
            new DocumentSubject('tax_summary', $id),
            CarbonImmutable::today()->addYears((int) config('tax.retention_years')),
        ));

        $synthese = new TaxSummary;
        $synthese->forceFill([
            'id' => $id,
            'scope' => $nouvelle->scope,
            'mandant_party_id' => $nouvelle->mandantPartyId,
            'income_year' => $annee,
            'form_version' => $nouvelle->income->formVersion,
            'status' => SummaryStatus::Final,
            'currency' => $nouvelle->income->currency,
            'snapshot' => $instantane,
            'ledger_cutoff' => $nouvelle->ledgerCutoff,
            'fingerprint' => $empreinte,
            'template_version' => $nouvelle->income->templateVersion,
            'issued_document_id' => $piece->id,
            'stored_file_id' => $piece->file->id,
            'supersedes_id' => $nouvelle->supersedesId,
            'rectification_reason' => $nouvelle->reason,
            'idempotency_key' => $nouvelle->idempotencyKey,
            'request_hash' => $nouvelle->requestHash,
            'lock_version' => 1,
            'active_key' => $nouvelle->activeKey,
            'created_by_user_id' => $nouvelle->userId,
        ])->save();

        $this->lines($synthese, $nouvelle);

        return $synthese;
    }

    private function lines(TaxSummary $synthese, NewSummaryData $nouvelle): void
    {
        $maintenant = CarbonImmutable::now()->format('Y-m-d H:i:s.u');
        $lignes = [];

        foreach ($nouvelle->income->properties as $bien) {
            foreach ($bien->lines as $l) {
                $lignes[] = [$bien->propertyId, $l];
            }
        }

        foreach ($nouvelle->income->totals as $l) {
            $lignes[] = [null, $l];
        }

        foreach (array_chunk($lignes, 100, true) as $paquet) {
            TaxSummaryLine::query()->insert(array_map(fn (array $entree, int $position): array => [
                'id' => (string) Str::uuid7(),
                'organization_id' => $synthese->organization_id,
                'summary_id' => $synthese->id,
                'property_id' => $entree[0],
                'line_code' => $entree[1]->code,
                'status' => $entree[1]->status,
                'amount_exact' => $entree[1]->exact,
                'amount_rounded' => $entree[1]->rounded,
                'sources' => json_encode($entree[1]->sources, JSON_THROW_ON_ERROR),
                'position' => $position,
                'created_at' => $maintenant,
                'updated_at' => $maintenant,
            ], $paquet, array_keys($paquet)));
        }
    }
}

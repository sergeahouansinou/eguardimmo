<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Enums\DocumentSequenceKind;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Events\NoticeIssued;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentNotice;
use App\Modules\Rent\Support\Advances;
use App\Modules\Rent\Support\Currencies;
use App\Modules\Rent\Support\DocumentNumbers;
use App\Modules\Rent\Support\OwnerRouting;
use App\Modules\Rent\Support\PdfRenderer;
use App\Modules\Rent\Support\PieceHtml;
use App\Modules\Rent\Support\Schedules;
use App\Modules\Rent\Support\Settlement;
use App\Modules\Rent\Support\Snapshots;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class IssueNotice
{
    public function __construct(
        private Schedules $echeanciers,
        private LeaseSchedule $baux,
        private Settlement $reglement,
        private Advances $avances,
        private DocumentNumbers $numeros,
        private Snapshots $instantanes,
        private PieceHtml $html,
        private PdfRenderer $pdf,
        private IssuedDocuments $documents,
        private OwnerRouting $routage,
        private RecordAudit $audit,
    ) {}

    /**
     * Émet l'avis d'échéance : numéro, PDF (Gotenberg) figé dans Documents, appel de loyer au grand livre et imputation
     * des avances, dans une seule transaction. Rejouable : une échéance déjà émise est renvoyée telle quelle.
     */
    public function handle(Installment $installment, CarbonImmutable $today): Installment
    {
        $bail = $this->baux->billing($installment->lease_id);
        $this->echeanciers->assertBillable($bail);

        return DB::transaction(function () use ($installment, $bail, $today): Installment {
            $this->echeanciers->lockExisting($installment->lease_id);
            $echeance = Installment::query()->whereKey($installment->id)->lockForUpdate()->firstOrFail();

            if ($echeance->status !== InstallmentStatus::Upcoming) {
                return $echeance->status === InstallmentStatus::Cancelled ? throw ErrorCode::InstallmentNotIssuable->problem() : $echeance;
            }

            $echeance->load('lines');
            $numero = $this->numeros->next(DocumentSequenceKind::Notice, $today);
            $instantane = $this->instantanes->notice($echeance, $numero, $today);
            $pdf = $this->pdf->render($this->html->render('notice', $instantane));

            $piece = $this->documents->issue(new NewIssuedDocumentData(
                IssuedDocumentType::RentNotice,
                $instantane,
                (string) $instantane['template_version'],
                FileSource::contents($pdf),
                "avis-echeance-{$numero}.pdf",
                new DocumentSubject('lease', $echeance->lease_id),
            ));

            RentNotice::query()->create([
                'installment_id' => $echeance->id,
                'number' => $numero,
                'issued_document_id' => $piece->id,
                'stored_file_id' => $piece->file->id,
                'fingerprint' => $piece->fingerprint,
                'template_version' => $piece->templateVersion,
                'snapshot' => $instantane,
                'issued_on' => $today->toDateString(),
                'issued_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);

            $this->routage->freeze($echeance);
            $ecriture = $this->reglement->postIssue($echeance, $bail->reference, $today);
            $echeance->status = InstallmentStatus::Issued;
            $echeance->issued_on = Carbon::instance($today);
            $echeance->ledger_entry_id = $ecriture->id;
            $echeance->save();

            $this->avances->apply($echeance->lease_id, Currencies::of($bail->currency), $today);

            $this->audit->handle('rent.notice.issued', subject: $echeance, metadata: ['number' => $numero, 'ledger_entry_id' => $ecriture->id]);
            NoticeIssued::dispatch($echeance->id, $echeance->lease_id, $echeance->organization_id, $echeance->due_date->toDateString());

            return $echeance->refresh();
        });
    }
}

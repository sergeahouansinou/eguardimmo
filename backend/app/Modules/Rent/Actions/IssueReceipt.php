<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Modules\Documents\PublicApi\IssuedDocuments;
use App\Modules\Rent\Enums\DocumentSequenceKind;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Events\ReceiptIssued;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Models\RentReceipt;
use App\Modules\Rent\Support\DocumentNumbers;
use App\Modules\Rent\Support\PdfRenderer;
use App\Modules\Rent\Support\PieceHtml;
use App\Modules\Rent\Support\Schedules;
use App\Modules\Rent\Support\Snapshots;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class IssueReceipt
{
    public function __construct(
        private Schedules $echeanciers,
        private DocumentNumbers $numeros,
        private Snapshots $instantanes,
        private PieceHtml $html,
        private PdfRenderer $pdf,
        private IssuedDocuments $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Quittance d'une échéance soldée. `$automatique` : l'émission qui suit un encaissement s'abstient quand un chèque a
     * servi à solder l'échéance (la quittance se demande alors) ; une demande explicite l'émet toujours. Rejouable :
     * une quittance valable existante est renvoyée.
     */
    public function handle(Installment $installment, CarbonImmutable $today, bool $automatique = false): ?RentReceipt
    {
        return DB::transaction(function () use ($installment, $today, $automatique): ?RentReceipt {
            $this->echeanciers->lockExisting($installment->lease_id);
            $echeance = Installment::query()->whereKey($installment->id)->lockForUpdate()->firstOrFail();

            if ($echeance->status !== InstallmentStatus::Paid) {
                throw ErrorCode::InstallmentNotPaid->problem();
            }

            $existante = RentReceipt::query()->where('installment_id', $echeance->id)->whereNull('voided_at')->first();

            if ($existante !== null) {
                return $existante;
            }

            if ($automatique && $this->paidByCheque($echeance)) {
                return null;
            }

            $echeance->load('lines');
            $numero = $this->numeros->next(DocumentSequenceKind::Receipt, $today);
            $instantane = $this->instantanes->receipt($echeance, $numero, $today);
            $pdf = $this->pdf->render($this->html->render('receipt', $instantane));

            $piece = $this->documents->issue(new NewIssuedDocumentData(
                IssuedDocumentType::RentReceipt,
                $instantane,
                (string) $instantane['template_version'],
                FileSource::contents($pdf),
                "quittance-{$numero}.pdf",
                new DocumentSubject('lease', $echeance->lease_id),
            ));

            $quittance = RentReceipt::query()->create([
                'lease_id' => $echeance->lease_id,
                'installment_id' => $echeance->id,
                'number' => $numero,
                'issued_document_id' => $piece->id,
                'stored_file_id' => $piece->file->id,
                'fingerprint' => $piece->fingerprint,
                'template_version' => $piece->templateVersion,
                'snapshot' => $instantane,
                'currency' => $echeance->currency,
                'rent_amount' => $echeance->rent_amount,
                'charges_amount' => $echeance->charges_amount,
                'vat_amount' => $echeance->vat_amount,
                'total_amount' => $echeance->total_amount,
                'issued_on' => $today->toDateString(),
                'issued_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);

            $this->audit->handle('rent.receipt.issued', subject: $echeance, metadata: ['number' => $numero, 'receipt_id' => $quittance->id]);
            ReceiptIssued::dispatch($quittance->id, $echeance->id, $echeance->lease_id, $echeance->organization_id);

            return $quittance;
        });
    }

    public function paidByCheque(Installment $echeance): bool
    {
        return PaymentAllocation::query()
            ->where('installment_id', $echeance->id)
            ->whereNull('reversed_at')
            ->whereHas('payment', fn ($paiement) => $paiement->where('method', PaymentMethod::Cheque->value))
            ->exists();
    }
}

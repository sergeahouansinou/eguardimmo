<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Models\LoanInterestAttestation;
use App\Modules\Investments\Support\Attachments;
use App\Modules\Investments\Support\Currencies;
use App\Modules\Investments\Support\LoanLock;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Montants attestés par la banque pour une année : pièce obligatoire, une seule attestation par prêt et par année.
 */
final readonly class AddLoanAttestation
{
    public function __construct(private LoanLock $verrou, private Attachments $pieces, private RecordAudit $audit) {}

    public function handle(string $loanId, int $year, int $interest, int $insurance, int $fees, UploadedFile $document): LoanInterestAttestation
    {
        return DB::transaction(function () use ($loanId, $year, $interest, $insurance, $fees, $document): LoanInterestAttestation {
            $pret = $this->verrou->lock($loanId);
            $this->verrou->assertNotVoided($pret);

            if (LoanInterestAttestation::query()->where('loan_id', $pret->id)->where('income_year', $year)->exists()) {
                throw ErrorCode::AttestationExists->problem();
            }

            $attestation = LoanInterestAttestation::query()->create([
                'loan_id' => $pret->id, 'income_year' => $year, 'currency' => $pret->currency, 'interest' => Currencies::money($interest, $pret->currency), 'insurance' => Currencies::money($insurance, $pret->currency), 'fees' => Currencies::money($fees, $pret->currency),
                'stored_file_id' => $this->pieces->store($document, 'loan', $pret->id),
            ]);
            $this->audit->handle('investments.loan.attested', subject: $pret);

            return $attestation;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Enums\FeeKind;
use App\Modules\Investments\Models\LoanFee;
use App\Modules\Investments\Support\Attachments;
use App\Modules\Investments\Support\Currencies;
use App\Modules\Investments\Support\LoanLock;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final readonly class AddLoanFee
{
    public function __construct(private LoanLock $verrou, private Attachments $pieces, private RecordAudit $audit) {}

    public function handle(string $loanId, FeeKind $kind, string $paidOn, int $amount, ?UploadedFile $document): LoanFee
    {
        return DB::transaction(function () use ($loanId, $kind, $paidOn, $amount, $document): LoanFee {
            $pret = $this->verrou->lock($loanId);
            $this->verrou->assertActive($pret);
            $id = (new LoanFee)->newUniqueId();
            $frais = new LoanFee([
                'loan_id' => $pret->id, 'kind' => $kind->value, 'paid_on' => $paidOn, 'currency' => $pret->currency, 'amount' => Currencies::money($amount, $pret->currency),
                'stored_file_id' => $document === null ? null : $this->pieces->store($document, 'loan_fee', $id),
            ]);
            $frais->id = $id;
            $frais->save();

            $this->audit->handle('investments.loan.fee_added', subject: $pret);

            return $frais;
        });
    }
}

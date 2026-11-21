<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanUsage;
use App\Modules\Investments\Support\LoanLock;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Annulation de la saisie (remplace la suppression) ; refusée si une synthèse fiscale figée s'appuie sur le prêt.
 */
final readonly class VoidLoan
{
    public function __construct(private LoanLock $verrou, private RecordAudit $audit) {}

    public function handle(string $loanId, string $reason, int $lockVersion): Loan
    {
        return DB::transaction(function () use ($loanId, $reason, $lockVersion): Loan {
            $pret = $this->verrou->lock($loanId, $lockVersion);

            if ($pret->status === LoanStatus::Voided) {
                throw ErrorCode::LoanStateInvalid->problem('Ce prêt est déjà annulé.');
            }

            if (LoanUsage::query()->where('loan_id', $pret->id)->exists()) {
                throw ErrorCode::LoanInUse->problem();
            }

            $pret->forceFill(['status' => LoanStatus::Voided->value, 'void_reason' => $reason, 'lock_version' => $pret->lock_version + 1])->save();
            $this->audit->handle('investments.loan.voided', subject: $pret);

            return $pret;
        });
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Investments\Support;

use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Models\Loan;
use Illuminate\Support\Str;

final class LoanLock
{
    /**
     * Verrou d'écriture du prêt, dans la transaction de l'appelant ; hors de l'organisation courante, 404.
     */
    public function lock(string $id, ?int $lockVersion = null): Loan
    {
        $pret = (Str::isUuid($id) ? Loan::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::LoanNotFound->problem();

        if ($lockVersion !== null && $pret->lock_version !== $lockVersion) {
            throw ErrorCode::LoanVersionConflict->problem();
        }

        return $pret;
    }

    public function assertActive(Loan $pret): void
    {
        if ($pret->status !== LoanStatus::Active) {
            throw ErrorCode::LoanStateInvalid->problem();
        }
    }

    public function assertNotVoided(Loan $pret): void
    {
        if ($pret->status === LoanStatus::Voided) {
            throw ErrorCode::LoanStateInvalid->problem();
        }
    }
}

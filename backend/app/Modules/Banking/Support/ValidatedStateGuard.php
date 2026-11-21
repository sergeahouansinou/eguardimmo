<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\BankStatementLine;

/**
 * Une ligne couverte par un état de rapprochement validé (date au plus égale à sa date d'arrêté) ne change plus d'état.
 */
final class ValidatedStateGuard
{
    /**
     * @param  iterable<BankStatementLine>  $lignes
     */
    public function assertNotCovered(string $accountId, iterable $lignes): void
    {
        $plusRecente = null;

        foreach ($lignes as $ligne) {
            $date = $ligne->booking_date->toDateString();
            $plusRecente = $plusRecente === null || $date < $plusRecente ? $date : $plusRecente;
        }

        if ($plusRecente === null) {
            return;
        }

        $couverte = BankReconciliation::query()->where('bank_account_id', $accountId)->where('status', ReconciliationStatus::Validated)
            ->whereDate('as_of', '>=', $plusRecente)->exists();

        if ($couverte) {
            throw ErrorCode::IgnoreForbidden->problem('La ligne est couverte par un état de rapprochement validé.');
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Models\BankStatementLine;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Annulation d'un import (mauvais compte, mauvais fichier) : le relevé et ses lignes restent, exclus des listes et des états.
 * Refusée si une ligne est pointée ou si un état validé couvre déjà sa période.
 */
final readonly class VoidStatement
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(string $statementId, string $reason, string $userId): BankStatement
    {
        return DB::transaction(function () use ($statementId, $reason, $userId): BankStatement {
            $releve = BankStatement::query()->lockForUpdate()->find($statementId) ?? throw ErrorCode::StatementNotFound->problem();

            if ($releve->voided_at !== null) {
                return $releve;
            }

            $lignes = BankStatementLine::query()->where('statement_id', $releve->id)->orderBy('id')->lockForUpdate()->get(['id', 'state']);

            if ($lignes->contains(fn (BankStatementLine $l): bool => $l->state === LineState::Matched)) {
                throw ErrorCode::StatementVoidForbidden->problem();
            }

            $fige = BankReconciliation::query()->where('bank_account_id', $releve->bank_account_id)->where('status', ReconciliationStatus::Validated)
                ->whereDate('as_of', '>=', $releve->period_from->toDateString())->exists();

            if ($fige) {
                throw ErrorCode::StatementVoidForbidden->problem();
            }

            $releve->forceFill(['voided_at' => now(), 'voided_by_user_id' => $userId, 'void_reason' => $reason])->save();
            DB::table('bank_suggestions')->whereIn('statement_line_id', $lignes->pluck('id')->all())->delete();
            $this->audit->handle('banking.statement.voided', subject: $releve, metadata: ['lines' => $lignes->count()]);

            return $releve;
        });
    }
}

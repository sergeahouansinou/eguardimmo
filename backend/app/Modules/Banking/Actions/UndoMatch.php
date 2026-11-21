<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LineState;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Enums\ReconciliationStatus;
use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\LineLocker;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Money\Currency;

/**
 * Défaire un pointage ne contrepasse rien : l'encaissement créé reste au grand livre. Refusé si le pointage entre dans un
 * état de rapprochement validé (toutes ses lignes datées au plus tard de la fin du mois validé).
 */
final readonly class UndoMatch
{
    public function __construct(private LineLocker $verrou, private BankBook $livre, private RecordAudit $audit) {}

    public function handle(string $matchId, string $reason, string $userId): BankMatch
    {
        return DB::transaction(function () use ($matchId, $reason, $userId): BankMatch {
            $apercu = BankMatch::query()->find($matchId) ?? throw ErrorCode::MatchNotFound->problem();
            $ids = $apercu->items()->where('side', MatchSide::StatementLine)->pluck('ref_id')->all();

            $this->verrou->lock($apercu->bank_account_id, array_values($ids));

            $pointage = BankMatch::query()->lockForUpdate()->findOrFail($matchId);

            if ($pointage->undone_at !== null) {
                return $pointage;
            }

            $this->assertNotLocked($pointage);

            $maintenant = now();
            DB::table('bank_match_items')->where('match_id', $pointage->id)->update(['undone_at' => $maintenant, 'updated_at' => $maintenant]);
            $pointage->forceFill(['undone_at' => $maintenant, 'undone_by_user_id' => $userId, 'undo_reason' => $reason])->save();
            DB::table('bank_statement_lines')->whereIn('id', $ids)
                ->update(['state' => LineState::Unmatched->value, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => $maintenant]);

            $this->audit->handle('banking.match.undone', subject: $pointage, metadata: ['kind' => $pointage->kind->value, 'statement_lines' => count($ids)]);

            return $pointage;
        });
    }

    private function assertNotLocked(BankMatch $pointage): void
    {
        $valide = BankReconciliation::query()->where('bank_account_id', $pointage->bank_account_id)->where('status', ReconciliationStatus::Validated)->max('as_of');

        if ($valide === null) {
            return;
        }

        $compte = OrganizationBankAccount::query()->findOrFail($pointage->bank_account_id);
        $plusTard = null;
        $ids = $pointage->items()->get();
        $lignes = BankStatementLine::query()->whereIn('id', $ids->where('side', MatchSide::StatementLine)->pluck('ref_id')->all())->get();

        foreach ($lignes as $ligne) {
            $plusTard = max($plusTard ?? '', $ligne->booking_date->toDateString());
        }

        $journal = $this->livre->find($compte->ledger_role->accountRole(), new Currency($compte->currency), array_values($ids->where('side', MatchSide::JournalLine)->pluck('ref_id')->all()));

        foreach ($journal as $ecriture) {
            $plusTard = max($plusTard ?? '', $ecriture->entryDate);
        }

        if ($plusTard !== null && $plusTard <= substr((string) $valide, 0, 10)) {
            throw ErrorCode::MatchLocked->problem();
        }
    }
}

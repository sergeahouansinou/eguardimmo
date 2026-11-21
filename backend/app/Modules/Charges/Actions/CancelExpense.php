<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Enums\SourceKind;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CancelExpense
{
    public function __construct(
        private Locks $verrous,
        private Ledger $livre,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * Contrepasse l'écriture d'une dépense comptabilisée ; refusée tant qu'un exercice non écarté s'en sert. Rejouable : une dépense déjà annulée est renvoyée.
     */
    public function handle(string $expenseId, string $motif): Expense
    {
        return DB::transaction(function () use ($expenseId, $motif): Expense {
            $depense = $this->verrous->expense($expenseId);

            if ($depense->status === ExpenseStatus::Cancelled) {
                return $depense;
            }

            $this->assertAccess($depense);
            $this->verrous->source(SourceKind::Expense, $depense->id);

            if ($this->inUse($depense->id)) {
                throw ErrorCode::ExpenseInUse->problem();
            }

            $entree = null;

            if ($depense->ledger_entry_id !== null) {
                if ($depense->mandant_party_id !== null && $depense->settlement->movesThirdPartyFunds()) {
                    $this->livre->lockParty($depense->mandant_party_id);
                }

                $entree = $this->livre->reverse($depense->ledger_entry_id, CarbonImmutable::today())->id;
            }

            $depense->forceFill([
                'status' => ExpenseStatus::Cancelled,
                'cancel_reason' => $motif,
                'active_fingerprint' => null,
                'cancellation_entry_id' => $entree,
                'lock_version' => $depense->lock_version + 1,
            ])->save();

            $this->audit->handle('charges.expense.cancelled', subject: $depense);

            return $depense;
        });
    }

    private function assertAccess(Expense $depense): void
    {
        if ($depense->ledger_entry_id !== null) {
            $this->operateurs->assertRole([MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant]);
            $this->operateurs->assertTwoFactor();
        }
    }

    private function inUse(string $expenseId): bool
    {
        $exercices = ChargeItemSource::query()->where('source_kind', SourceKind::Expense->value)->where('source_id', $expenseId)->pluck('exercise_id')->all();

        return $exercices !== [] && ChargeExercise::query()->whereIn('id', $exercices)->where('status', '<>', ExerciseStatus::Discarded->value)->exists();
    }
}

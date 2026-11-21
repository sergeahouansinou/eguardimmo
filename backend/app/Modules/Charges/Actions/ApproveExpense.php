<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Support\ExpenseLedger;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ApproveExpense
{
    public function __construct(
        private Locks $verrous,
        private ExpenseLedger $ecritures,
        private TermDirectory $termes,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * Seconde validation d'une dépense sur fonds de tiers : une autre personne habilitée que celle qui l'a saisie, double authentification
     * comprise. Les fonds du mandant sont contrôlés à cet instant, sous le verrou de son compte.
     */
    public function handle(string $expenseId): Expense
    {
        $this->operateurs->assertRole([MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant]);
        $this->operateurs->assertTwoFactor();

        return DB::transaction(function () use ($expenseId): Expense {
            $depense = $this->verrous->expense($expenseId);

            if ($depense->status !== ExpenseStatus::PendingApproval) {
                throw ErrorCode::ExpenseNotCancellable->problem('Cette dépense n\'attend aucune validation.');
            }

            if ($depense->created_by_user_id === $this->operateurs->userId()) {
                throw ErrorCode::SecondApproverRequired->problem('La validation doit venir d\'une autre personne habilitée que celle qui a saisi la dépense.');
            }

            $categorie = $this->termes->find($depense->category_term_id, VocabularyKey::ExpenseCategory)->key;
            $depense->forceFill([
                'ledger_entry_id' => $this->ecritures->post($depense, $categorie),
                'status' => ExpenseStatus::Recorded,
                'approved_by_user_id' => $this->operateurs->userId(),
                'lock_version' => $depense->lock_version + 1,
            ])->save();

            $this->audit->handle('charges.expense.approved', subject: $depense);

            return $depense;
        });
    }
}

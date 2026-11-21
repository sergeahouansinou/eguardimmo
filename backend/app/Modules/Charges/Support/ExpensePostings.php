<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Models\Expense;
use Carbon\CarbonImmutable;
use LogicException;

/**
 * Journal `purchases` (ADR 0034 § 3), clé `charges:expense:{id}:post`. Seule la ligne de dépense porte la pièce : `itemTotals` en tire le montant par catégorie.
 */
final class ExpensePostings
{
    public function post(Expense $depense, string $categoryKey): EntryData
    {
        $montant = $depense->total_gross;
        $date = CarbonImmutable::parse(($depense->paid_on ?? $depense->document_on)->toDateString());

        [$debit, $credit] = match ($depense->settlement) {
            ExpenseSettlement::Bank => [
                LineData::debit(AccountRole::Expenses, $montant, null, null, $depense->unit_id, ItemType::Expense, $depense->id),
                LineData::credit(AccountRole::Bank, $montant),
            ],
            ExpenseSettlement::Cash => [
                LineData::debit(AccountRole::Expenses, $montant, null, null, $depense->unit_id, ItemType::Expense, $depense->id),
                LineData::credit(AccountRole::Cash, $montant),
            ],
            ExpenseSettlement::Trust => [
                LineData::debit(AccountRole::OwnerPayable, $montant, null, $depense->mandant_party_id, $depense->unit_id, ItemType::Expense, $depense->id),
                LineData::credit(AccountRole::TrustBank, $montant),
            ],
            ExpenseSettlement::OwnFundsAdvance => [
                LineData::debit(AccountRole::OwnerPayable, $montant, null, $depense->mandant_party_id, $depense->unit_id, ItemType::Expense, $depense->id),
                LineData::credit(AccountRole::Bank, $montant),
            ],
            default => throw new LogicException('Ce mode de règlement ne s\'écrit pas au grand livre.'),
        };

        return new EntryData(
            Journal::Purchases,
            $date,
            "Dépense : {$categoryKey}",
            SourceType::Expense,
            $depense->id,
            "charges:expense:{$depense->id}:post",
            [$debit, $credit],
            OnClosedPeriod::RollForward,
        );
    }
}

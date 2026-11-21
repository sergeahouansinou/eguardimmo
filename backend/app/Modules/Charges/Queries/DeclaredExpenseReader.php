<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Data\DeclaredExpenseData;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Models\Expense;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final readonly class DeclaredExpenseReader
{
    /**
     * @param  list<string>|null  $unitIds  null : tous les lots ; liste vide : aucun
     * @return list<DeclaredExpenseData> par date, puis identifiant
     */
    public function between(CarbonImmutable $from, CarbonImmutable $toExclusive, ?array $unitIds = null): array
    {
        if ($unitIds === []) {
            return [];
        }

        $debut = $from->toDateString();
        $fin = $toExclusive->toDateString();

        return array_values(Expense::query()
            ->where('status', ExpenseStatus::Recorded->value)
            ->whereIn('settlement', [ExpenseSettlement::PaidByOwner->value, ExpenseSettlement::None->value])
            ->whereRaw('COALESCE(paid_on, document_on) >= ?', [$debut])
            ->whereRaw('COALESCE(paid_on, document_on) < ?', [$fin])
            ->when($unitIds !== null, fn (Builder $q): Builder => $q->whereIn('unit_id', (array) $unitIds))
            ->orderByRaw('COALESCE(paid_on, document_on)')
            ->orderBy('id')
            ->get()
            ->map(fn (Expense $d): DeclaredExpenseData => new DeclaredExpenseData(
                $d->id, $d->property_id, $d->unit_id, $d->category_term_id, ($d->paid_on ?? $d->document_on)->toDateString(),
                $d->settlement->value, $d->total_gross, $d->recoverable_amount, $d->mandant_party_id,
            ))->all());
    }
}

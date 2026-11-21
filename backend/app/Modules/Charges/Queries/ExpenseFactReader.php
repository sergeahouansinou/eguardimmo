<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Data\ExpenseFactData;
use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Models\Expense;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final readonly class ExpenseFactReader
{
    /**
     * @param  list<string>  $ids
     * @return array<string, ExpenseFactData> par identifiant ; un identifiant inconnu de l'organisation est absent
     */
    public function byIds(array $ids): array
    {
        $faits = [];

        foreach (array_chunk(array_values(array_unique($ids)), 500) as $lot) {
            foreach (Expense::query()->whereIn('id', $lot)->get() as $depense) {
                $faits[$depense->id] = $this->fait($depense);
            }
        }

        return $faits;
    }

    /**
     * Relevés annuels du syndic enregistrés dont le service commence dans l'intervalle semi-ouvert.
     *
     * @param  list<string>|null  $unitIds
     * @return list<ExpenseFactData>
     */
    public function statements(CarbonImmutable $from, CarbonImmutable $toExclusive, ?array $unitIds): array
    {
        if ($unitIds === []) {
            return [];
        }

        return array_values(Expense::query()
            ->where('kind', ExpenseKind::CoOwnershipStatement->value)
            ->where('status', ExpenseStatus::Recorded->value)
            ->where('service_from', '>=', $from->toDateString())
            ->where('service_from', '<', $toExclusive->toDateString())
            ->when($unitIds !== null, fn (Builder $q): Builder => $q->whereIn('unit_id', (array) $unitIds))
            ->orderBy('service_from')->orderBy('id')
            ->get()
            ->map(fn (Expense $d): ExpenseFactData => $this->fait($d))
            ->all());
    }

    private function fait(Expense $d): ExpenseFactData
    {
        return new ExpenseFactData(
            $d->id, $d->property_id, $d->unit_id, $d->kind->value, $d->category_term_id, $d->document_on->toDateString(), $d->paid_on?->toDateString(),
            $d->service_from->toDateString(), $d->service_to->toDateString(), $d->settlement->value, $d->status->value, $d->total_gross, $d->recoverable_amount, $d->mandant_party_id,
        );
    }
}

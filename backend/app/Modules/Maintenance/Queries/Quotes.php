<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Data\QuoteFilters;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final class Quotes
{
    /**
     * Tri par identifiant UUID v7 décroissant : l'ordre de création, sans dépendre d'une date.
     *
     * @return CursorPaginator<int, InterventionQuote>
     */
    public function page(QuoteFilters $filtres): CursorPaginator
    {
        return InterventionQuote::query()
            ->when($filtres->statuses !== [], fn (Builder $q) => $q->whereIn('status', $filtres->statuses))
            ->when($filtres->interventionId !== null, fn (Builder $q) => $q->where('intervention_id', $filtres->interventionId))
            ->when($filtres->supplierPartyId !== null, fn (Builder $q) => $q->where('supplier_party_id', $filtres->supplierPartyId))
            ->orderByDesc('id')
            ->cursorPaginate($filtres->perPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }

    /**
     * @param  iterable<InterventionQuote>  $devis
     */
    public function lookups(iterable $devis): QuoteLookups
    {
        $interventions = [];
        $devisIds = [];

        foreach ($devis as $d) {
            $interventions[$d->intervention_id] = true;
            $devisIds[] = $d->id;
        }

        if ($devisIds === []) {
            return new QuoteLookups([], []);
        }

        $parIntervention = Intervention::query()->whereIn('id', array_keys($interventions))->get()->keyBy('id')->all();
        $accords = [];

        foreach (InterventionApproval::query()->whereIn('quote_id', $devisIds)->orderBy('id')->get() as $accord) {
            $accords[(string) $accord->quote_id] = $accord;
        }

        return new QuoteLookups($parIntervention, $accords);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Tax\Queries;

use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Models\TaxSummary;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Synthèses de l'organisation courante : le contexte (`space:organization`) cloisonne ; un identifiant d'une autre organisation ou d'une
 * autre portée est une ressource inconnue (404).
 */
final readonly class Summaries
{
    public function find(string $id, SummaryScope $portee): TaxSummary
    {
        return (Str::isUuid($id) ? TaxSummary::query()->where('scope', $portee->value)->find($id) : null) ?? throw ErrorCode::SummaryNotFound->problem();
    }

    /**
     * @return Builder<TaxSummary>
     */
    public function listing(SummaryScope $portee, ?int $annee = null, ?string $mandant = null): Builder
    {
        return TaxSummary::query()
            ->where('scope', $portee->value)
            ->when($annee !== null, fn (Builder $q): Builder => $q->where('income_year', $annee))
            ->when($mandant !== null, fn (Builder $q): Builder => $q->where('mandant_party_id', $mandant))
            ->orderByDesc('income_year')
            ->orderByDesc('id');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Tax\Queries;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Modules\Tax\Models\TaxSummary;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Relevés fiscaux que le mandant peut lire : publiés, ou remplacés après publication. Un relevé final non publié n'existe pas pour lui.
 * La clé est celle de `MandateDirectory::ownerScope()` : couple (organisation, mandant), jamais l'un sans l'autre, jamais un total
 * entre agences.
 */
final class OwnerTaxStatements
{
    /**
     * @return Builder<TaxSummary>
     */
    public function listing(OwnerScopeData $portee, ?int $annee = null): Builder
    {
        return $this->visible($portee)
            ->when($annee !== null, fn (Builder $q): Builder => $q->where('income_year', $annee))
            ->orderByDesc('income_year')
            ->orderByDesc('id');
    }

    public function find(OwnerScopeData $portee, string $id): ?TaxSummary
    {
        return Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;
    }

    /**
     * @return Builder<TaxSummary>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        $requete = $portee->restrictToMandants(AcrossOrganizations::query(TaxSummary::class), 'organization_id', 'mandant_party_id');

        return $requete
            ->where('scope', SummaryScope::Mandant->value)
            ->whereIn('status', [SummaryStatus::Published->value, SummaryStatus::Superseded->value])
            ->whereNotNull('published_at');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Support\LeaseView;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final readonly class LeaseDetails
{
    public function __construct(
        private Leases $baux,
        private LeaseViews $vues,
    ) {}

    /**
     * Les composantes affichées sont celles en vigueur à la plus tardive de ces dates : aujourd'hui ou le début du bail.
     */
    public function get(string $id): LeaseView
    {
        $bail = $this->baux->get($id);
        $aujourdhui = CarbonImmutable::today();
        $reference = CarbonImmutable::parse($bail->starts_on->toDateString())->max($aujourdhui);
        $jour = $reference->toDateString();

        $bail->load([
            'units' => fn ($q) => $q->orderBy('valid_from')->orderBy('id'),
            'parties' => fn ($q) => $q->orderBy('valid_from')->orderBy('id'),
            'terms' => fn ($q) => $q
                ->where('valid_from', '<=', $jour)
                ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
                ->orderBy('valid_from')->orderBy('id'),
        ]);

        return $this->vues->of([$bail], $aujourdhui, $reference)[0];
    }

    /**
     * Historique complet des composantes, lignes fermées comprises.
     */
    public function terms(string $id): LeaseView
    {
        $bail = $this->baux->get($id);

        $bail->load(['terms' => fn ($q) => $q->orderBy('valid_from')->orderBy('id')]);

        return $this->vues->of([$bail], CarbonImmutable::today())[0];
    }
}

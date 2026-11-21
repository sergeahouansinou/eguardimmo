<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class References
{
    public function __construct(
        private ContinuousCounter $compteur,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * À appeler dans la transaction qui crée l'intervention : son annulation libère le numéro.
     */
    public function next(CarbonImmutable $date): string
    {
        $annee = (int) $date->format('Y');
        $numero = $this->compteur->next('intervention_sequences', ['organization_id' => $this->contexte->id(), 'year' => $annee]);

        return sprintf('INT-%d-%04d', $annee, $numero);
    }
}

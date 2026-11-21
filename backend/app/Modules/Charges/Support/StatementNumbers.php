<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class StatementNumbers
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * `DC-AAAA-NNNN`, continu par organisation et par année ; à appeler dans la transaction qui écrit le décompte : son annulation libère le numéro.
     */
    public function next(CarbonImmutable $date): string
    {
        $numero = $this->compteur->next('charge_sequences', ['organization_id' => $this->organisation->id(), 'year' => $date->year]);

        return sprintf('DC-%04d-%04d', $date->year, $numero);
    }
}

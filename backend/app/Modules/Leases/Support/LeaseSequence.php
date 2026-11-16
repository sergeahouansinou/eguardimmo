<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class LeaseSequence
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * Référence `BL-AAAA-NNNN`, continue par organisation et par année ; à appeler dans la transaction qui écrit le bail,
     * pour que son annulation libère le numéro.
     */
    public function next(int $year): string
    {
        $numero = $this->compteur->next('lease_sequences', ['organization_id' => $this->organisation->id(), 'year' => $year]);

        return sprintf('BL-%04d-%04d', $year, $numero);
    }
}

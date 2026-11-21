<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class MandateSequence
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * Référence `M-AAAA-NNNN`, continue par organisation et par année ; à appeler dans la transaction qui écrit le mandat,
     * pour que son annulation libère le numéro.
     */
    public function next(int $year): string
    {
        $numero = $this->compteur->next('mandate_sequences', ['organization_id' => $this->organisation->id(), 'year' => $year]);

        return sprintf('M-%04d-%04d', $year, $numero);
    }
}

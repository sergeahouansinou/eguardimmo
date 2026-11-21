<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class Numbers
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * `FA-AAAA-NNNN` (facture) ou `AF-AAAA-NNNN` (avoir), continu par organisation, par type et par année ; à appeler dans
     * la transaction d'émission, pour que son annulation libère le numéro : un brouillon n'en consomme jamais.
     */
    public function next(InvoiceKind $genre, CarbonImmutable $date): string
    {
        $numero = $this->compteur->next('invoice_sequences', [
            'organization_id' => $this->organisation->id(),
            'kind' => $genre->value,
            'year' => $date->year,
        ]);

        return sprintf('%s-%04d-%04d', $genre->prefix(), $date->year, $numero);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Enums\DocumentSequenceKind;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class DocumentNumbers
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    /**
     * `QT-AAAA-NNNN` (quittance) ou `AV-AAAA-NNNN` (avis), continu par organisation, par type et par année ; à appeler dans
     * la transaction qui écrit la pièce, pour que son annulation libère le numéro.
     */
    public function next(DocumentSequenceKind $genre, CarbonImmutable $date): string
    {
        $numero = $this->compteur->next('rent_sequences', [
            'organization_id' => $this->organisation->id(),
            'kind' => $genre->value,
            'year' => $date->year,
        ]);

        return sprintf('%s-%04d-%04d', $genre->prefix(), $date->year, $numero);
    }
}

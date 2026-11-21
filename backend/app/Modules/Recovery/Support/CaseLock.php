<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Recovery\Enums\SequenceKind;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Verrou de l'organisation pour tout ce qui décide de l'appartenance d'une créance à un dossier : ouverture, ajout.
 * Il réutilise la ligne de compteur, dont l'upsert pose le verrou de ligne sans verrou d'intervalle.
 */
final readonly class CaseLock
{
    public function __construct(
        private CurrentOrganization $organisation,
        private ContinuousCounter $compteur,
    ) {}

    public function acquire(): void
    {
        $this->compteur->next('recovery_sequences', [
            'organization_id' => $this->organisation->id(),
            'kind' => SequenceKind::Lock->value,
            'year' => 0,
        ]);
    }
}

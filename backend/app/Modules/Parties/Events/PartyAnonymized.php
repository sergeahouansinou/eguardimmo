<?php

declare(strict_types=1);

namespace App\Modules\Parties\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Une fiche vient d'être anonymisée ; les modules qui détiennent des textes de la personne les effacent à leur tour.
 */
final readonly class PartyAnonymized implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $partyId,
        public string $organizationId,
    ) {}
}

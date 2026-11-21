<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

/**
 * Couverture d'un lot par un mandat du mandant d'un compte propriétaire (ADR 0032) ; `$from` et `$to` sont inclus.
 */
final readonly class OwnerCoverageData
{
    public function __construct(
        public string $organizationId,
        public string $mandantPartyId,
        public string $mandateId,
        public string $unitId,
        public string $from,
        public string $to,
    ) {}
}

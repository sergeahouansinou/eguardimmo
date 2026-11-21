<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\PublicApi;

use App\Modules\Maintenance\Queries\OwnerPendingApprovals;
use App\Modules\Mandates\Data\OwnerScopeData;

/**
 * Lecture, pour l'accueil du mandant, des devis qui attendent sa décision ; la clé est celle de `MandateDirectory::ownerScope()`.
 */
final readonly class OwnerApprovals
{
    public function __construct(private OwnerPendingApprovals $attente) {}

    public function pendingCount(OwnerScopeData $portee): int
    {
        return $this->attente->count($portee);
    }
}

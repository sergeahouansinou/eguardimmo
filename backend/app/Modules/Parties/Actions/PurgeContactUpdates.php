<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Queries\ContactUpdates;
use Carbon\CarbonInterface;

final readonly class PurgeContactUpdates
{
    public function __construct(private ContactUpdates $demandes) {}

    /**
     * Demandes de plus de 90 jours, traitées ou non (ADR 0036, décision 3).
     */
    public function handle(CarbonInterface $now): int
    {
        return $this->demandes->purge($now);
    }
}

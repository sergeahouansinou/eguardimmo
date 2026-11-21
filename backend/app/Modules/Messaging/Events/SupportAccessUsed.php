<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Première lecture d'un accès consenti par le support.
 */
final readonly class SupportAccessUsed implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $organizationId, public string $grantId) {}
}

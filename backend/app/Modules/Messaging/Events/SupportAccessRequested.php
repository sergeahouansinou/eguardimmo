<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un opérateur demande l'accès du support aux données d'une organisation ; ni motif ni nom d'opérateur (ADR 0033, décision 9).
 */
final readonly class SupportAccessRequested implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $organizationId, public string $grantId) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Accès d'urgence ouvert sans consentement : l'organisation en est prévenue aussitôt.
 */
final readonly class SupportAccessEmergencyOpened implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $organizationId, public string $grantId) {}
}

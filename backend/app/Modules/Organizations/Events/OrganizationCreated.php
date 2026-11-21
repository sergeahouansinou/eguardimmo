<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Émis à la création d'une organisation par CreateOrganization ; Subscriptions y ouvre l'essai.
 */
final readonly class OrganizationCreated implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $organizationId, public string $country) {}
}

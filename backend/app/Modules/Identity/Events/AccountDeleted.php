<?php

declare(strict_types=1);

namespace App\Modules\Identity\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Le compte est marqué supprimé, jamais effacé : chaque module anonymise ou conserve selon ses obligations.
 */
final readonly class AccountDeleted implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $userId) {}
}

<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

final readonly class PrivacyRequestReceived implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(public string $requestId, public string $requesterUserId) {}
}

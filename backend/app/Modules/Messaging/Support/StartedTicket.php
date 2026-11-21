<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Models\SupportTicket;

final readonly class StartedTicket
{
    public function __construct(public SupportTicket $ticket, public bool $replayed) {}
}

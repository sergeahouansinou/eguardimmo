<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\TicketLoader;

final class ShowTicketController
{
    public function __invoke(string $ticket): TicketDetailResource
    {
        return new TicketDetailResource(TicketLoader::forSupport($ticket), vueSupport: true);
    }
}

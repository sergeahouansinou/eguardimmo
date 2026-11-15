<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Actions\UpdateSupportTicket;
use App\Modules\Messaging\Http\Requests\UpdateTicketRequest;
use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\TicketLoader;

final class UpdateTicketController
{
    public function __invoke(UpdateTicketRequest $request, string $ticket, UpdateSupportTicket $modifier): TicketDetailResource
    {
        $modifier->handle(TicketLoader::forSupport($ticket), $request->toData());

        return new TicketDetailResource(TicketLoader::forSupport($ticket), vueSupport: true);
    }
}

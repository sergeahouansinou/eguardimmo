<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers;

use App\Modules\Messaging\Actions\MarkSupportTicketRead;
use App\Modules\Messaging\Http\Requests\MarkTicketReadRequest;
use App\Modules\Messaging\Http\Resources\TicketDetailResource;
use App\Modules\Messaging\Support\TicketLoader;

final class UpdateMyTicketController
{
    public function __invoke(MarkTicketReadRequest $request, string $ticket, MarkSupportTicketRead $lecture): TicketDetailResource
    {
        $lecture->handle(TicketLoader::forRequester($request, $ticket), parLeSupport: false);

        return new TicketDetailResource(TicketLoader::forRequester($request, $ticket), vueSupport: false);
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Http\Requests\ListTicketMessagesRequest;
use App\Modules\Messaging\Support\TicketLoader;
use App\Modules\Messaging\Support\TicketMessagePage;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTicketMessagesController
{
    public function __invoke(ListTicketMessagesRequest $request, string $ticket, TicketMessagePage $page): AnonymousResourceCollection
    {
        return $page->handle($request, TicketLoader::lightForSupport($ticket), vueSupport: true);
    }
}

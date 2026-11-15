<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Console;

use App\Modules\Messaging\Http\Requests\ListTicketsRequest;
use App\Modules\Messaging\Http\Resources\TicketSummaryResource;
use App\Modules\Messaging\Queries\SupportTickets;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTicketsController
{
    public function __invoke(ListTicketsRequest $request, SupportTickets $tickets): AnonymousResourceCollection
    {
        $filtres = $request->toData();

        return TicketSummaryResource::collection($tickets->list($filtres))->additional(['counts' => $tickets->counts($filtres)]);
    }
}

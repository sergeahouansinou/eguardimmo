<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers;

use App\Modules\Messaging\Http\Requests\ListMyTicketsRequest;
use App\Modules\Messaging\Http\Resources\TicketSummaryResource;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListMyTicketsController
{
    public function __invoke(ListMyTicketsRequest $request): AnonymousResourceCollection
    {
        $tickets = SupportTicket::query()
            ->where('requester_user_id', $request->user()?->getAuthIdentifier())
            ->with(['requester', 'assignee'])
            ->withCount(['messages' => fn ($q) => $q->where('internal', false)])
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->cursorPaginate($request->perPage());

        return TicketSummaryResource::collection($tickets);
    }
}

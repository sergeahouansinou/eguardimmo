<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Http\Requests\ListTicketMessagesRequest;
use App\Modules\Messaging\Http\Resources\SupportMessageResource;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Messaging\Queries\SupportMessages;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final readonly class TicketMessagePage
{
    public function __construct(private SupportMessages $messages) {}

    public function handle(ListTicketMessagesRequest $request, SupportTicket $ticket, bool $vueSupport): AnonymousResourceCollection
    {
        $page = $this->messages->after($ticket, $request->marker(), $request->perPage(), $vueSupport);

        return SupportMessageResource::collection($page['messages']->map(fn (SupportTicketMessage $m): SupportMessageResource => new SupportMessageResource($m, $vueSupport)))
            ->additional(['meta' => [
                'has_more' => $page['has_more'],
                'status' => $ticket->status->value,
                'requester_last_read_at' => $ticket->requester_last_read_at?->toIso8601String(),
                'support_last_read_at' => $ticket->support_last_read_at?->toIso8601String(),
            ]]);
    }
}

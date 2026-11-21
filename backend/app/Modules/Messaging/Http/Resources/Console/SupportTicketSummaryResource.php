<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Console;

use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Http\Resources\TicketSummaryResource;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupportTicket $resource
 */
final class SupportTicketSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $ticket = $this->resource;

        return [
            ...(new TicketSummaryResource($ticket))->toArray($request),
            'organization_id' => $ticket->organization_id,
            'assignee' => $ticket->assignee === null ? null : ['id' => $ticket->assignee->id, 'name' => $ticket->assignee->name],
            'first_response_overdue' => $ticket->first_response_at === null
                && $ticket->status !== TicketStatus::Resolved
                && $ticket->created_at->copy()->addWeekdays(1)->isPast(),
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources;

use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupportTicket $resource
 */
final class TicketSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $ticket = $this->resource;

        return [
            'id' => $ticket->id,
            'reference' => $ticket->reference,
            'subject' => $ticket->subject,
            'organization' => $ticket->organization_name,
            'space' => $ticket->space->value,
            'requester' => ['id' => $ticket->requester_user_id, 'name' => $ticket->requester->name],
            'assignee' => $ticket->assignee === null ? null : ['id' => $ticket->assignee->id, 'name' => $ticket->assignee->name],
            'priority' => $ticket->priority->value,
            'status' => $ticket->status->value,
            'category' => $ticket->category->value,
            'created_at' => $ticket->created_at->toIso8601String(),
            'updated_at' => $ticket->last_activity_at->toIso8601String(),
            'message_count' => (int) ($ticket->getAttributes()['messages_count'] ?? $ticket->messages->count()),
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources;

use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupportTicket $resource
 */
final class TicketDetailResource extends JsonResource
{
    public function __construct(SupportTicket $resource, private readonly bool $vueSupport)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $ticket = $this->resource;
        $messages = $ticket->messages->filter(fn (SupportTicketMessage $m): bool => $this->vueSupport || ! $m->internal)->values();
        $acces = $this->vueSupport
            ? $ticket->accessGrants->first(fn (SupportAccessGrant $g): bool => $g->operator_user_id === $request->user()?->getAuthIdentifier() && $g->expires_at->isFuture())
            : null;

        return [
            ...(new TicketSummaryResource($ticket))->toArray($request),
            'message_count' => $messages->count(),
            'first_response_at' => $ticket->first_response_at?->toIso8601String(),
            'messages' => SupportMessageResource::collection($messages)->toArray($request),
            'access' => $acces === null ? null : [
                'reason' => $acces->reason,
                'granted_at' => $acces->granted_at->toIso8601String(),
                'expires_at' => $acces->expires_at->toIso8601String(),
            ],
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources;

use App\Modules\Messaging\Http\Resources\Console\SupportAccessGrantResource;
use App\Modules\Messaging\Http\Resources\Console\SupportTicketSummaryResource;
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
        $resume = $this->vueSupport ? new SupportTicketSummaryResource($ticket) : new TicketSummaryResource($ticket);
        $detail = [
            ...$resume->toArray($request),
            'message_count' => (int) ($ticket->getAttributes()['messages_total'] ?? $messages->count()),
            'has_more' => (bool) $ticket->getAttribute('messages_has_more'),
            'first_response_at' => $ticket->first_response_at?->toIso8601String(),
            'messages' => $messages->map(fn (SupportTicketMessage $m): array => (new SupportMessageResource($m, $this->vueSupport))->toArray($request))->all(),
        ];

        if (! $this->vueSupport) {
            return $detail;
        }

        $vivant = $ticket->accessGrants->first(fn (SupportAccessGrant $g): bool => $g->operator_user_id === $request->user()?->getAuthIdentifier() && $g->isLive());

        return [
            ...$detail,
            'access' => $vivant === null ? null : [
                'reason' => $vivant->reason,
                'granted_at' => $vivant->granted_at?->toIso8601String(),
                'expires_at' => $vivant->expires_at?->toIso8601String(),
            ],
            'access_grants' => $ticket->accessGrants->map(fn (SupportAccessGrant $g): array => (new SupportAccessGrantResource($g))->toArray($request))->values()->all(),
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Organization;

use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartThreadResource;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Support\ThreadLookups;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Fil avec une contrepartie, vu de l'équipe de gestion de l'organisation.
 *
 * @property array{conversation: Conversation, lookups: ThreadLookups, viewer: string} $resource
 */
final class ExternalThreadResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $fil = $this->resource['conversation'];
        $lookups = $this->resource['lookups'];
        $mes = (string) $fil->getAttribute('my_last_read_at');
        $nombre = $fil->getAttribute('messages_count');
        $assigne = $fil->assignee_user_id;

        return [
            'id' => $fil->id,
            'kind' => $fil->kind->value,
            'subject' => $fil->subject,
            'status' => $fil->status->value,
            'closed_at' => $fil->closed_at?->toIso8601String(),
            'party' => ['id' => $fil->party_id, 'name' => $lookups->parties[(string) $fil->party_id] ?? null],
            'lease' => $fil->lease_id === null ? null : ['id' => $fil->lease_id, 'reference' => $lookups->leases[$fil->lease_id] ?? null],
            'mandate' => $fil->mandate_id === null ? null : ['id' => $fil->mandate_id, 'reference' => $lookups->mandates[$fil->mandate_id] ?? null],
            'assignee' => $assigne === null ? null : ['id' => $assigne, 'name' => $lookups->assignees[$assigne] ?? null],
            'preview' => Str::limit((string) $fil->getAttribute('preview_body'), 140),
            'last_message_at' => $fil->last_message_at->toIso8601String(),
            'last_author_side' => $fil->last_author_side->value,
            'last_author_name' => $fil->getAttribute('last_author_name'),
            'unread' => $fil->last_author_user_id !== $this->resource['viewer'] && ($mes === '' || CarbonImmutable::parse($mes)->lt($fil->last_message_at)),
            'archived' => $fil->getAttribute('my_archived_at') !== null,
            'awaiting_reply' => $fil->status === ConversationStatus::Open && $fil->last_author_side->value !== 'staff',
            'message_count' => is_numeric($nombre) ? (int) $nombre : 0,
            'has_attachments' => (int) $fil->getAttribute('preview_attachments') > 0,
            'counterpart_last_read_at' => CounterpartThreadResource::iso($fil->getAttribute('other_last_read_at')),
            'muted_until' => $fil->counterpart_muted_until?->isFuture() === true ? $fil->counterpart_muted_until->toIso8601String() : null,
            'muted_reason' => $fil->counterpart_muted_until?->isFuture() === true ? $fil->counterpart_muted_reason : null,
        ];
    }
}

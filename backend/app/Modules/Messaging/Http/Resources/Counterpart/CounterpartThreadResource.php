<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Counterpart;

use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Support\ThreadLookups;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Fil vu du locataire ou du mandant : aucun identifiant de fiche, de rôle interne, de note ni d'assigné (ADR 0033, décision 13).
 *
 * @property array{conversation: Conversation, lookups: ThreadLookups, viewer: string, can_reply: bool} $resource
 */
final class CounterpartThreadResource extends JsonResource
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

        return [
            'id' => $fil->id,
            'subject' => $fil->subject,
            'status' => $fil->status->value,
            'agency' => ['id' => $fil->organization_id, 'name' => $lookups->organizations[$fil->organization_id] ?? null],
            'lease' => $fil->lease_id === null ? null : ['id' => $fil->lease_id, 'reference' => $lookups->leases[$fil->lease_id] ?? null],
            'mandate' => $fil->mandate_id === null ? null : ['id' => $fil->mandate_id, 'reference' => $lookups->mandates[$fil->mandate_id] ?? null],
            'preview' => Str::limit((string) $fil->getAttribute('preview_body'), 140),
            'last_message_at' => $fil->last_message_at->toIso8601String(),
            'last_author' => $fil->last_author_side === MessageSide::Staff ? 'agency' : ($fil->last_author_user_id === $this->resource['viewer'] ? 'me' : 'other'),
            'unread' => $fil->last_author_user_id !== $this->resource['viewer'] && ($mes === '' || CarbonImmutable::parse($mes)->lt($fil->last_message_at)),
            'archived' => $fil->getAttribute('my_archived_at') !== null,
            'message_count' => is_numeric($nombre) ? (int) $nombre : 0,
            'has_attachments' => (int) $fil->getAttribute('preview_attachments') > 0,
            'agency_last_read_at' => self::iso($fil->getAttribute('other_last_read_at')),
            'muted' => $fil->counterpart_muted_until?->isFuture() === true,
            'muted_until' => $fil->counterpart_muted_until?->isFuture() === true ? $fil->counterpart_muted_until->toIso8601String() : null,
            'can_reply' => $this->resource['can_reply'] && $fil->status === ConversationStatus::Open && $fil->counterpart_muted_until?->isFuture() !== true,
        ];
    }

    public static function iso(mixed $valeur): ?string
    {
        return is_string($valeur) && $valeur !== '' ? CarbonImmutable::parse($valeur)->toIso8601String() : null;
    }
}

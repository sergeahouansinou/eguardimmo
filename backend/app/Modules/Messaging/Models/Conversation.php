<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\MessageSide;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $subject
 * @property string $created_by_user_id
 * @property CarbonImmutable $last_message_at
 * @property string $last_author_user_id
 * @property ConversationKind $kind
 * @property MessageSide $last_author_side
 * @property string|null $party_id
 * @property string|null $lease_id
 * @property string|null $mandate_id
 * @property string|null $intervention_id
 * @property ConversationStatus $status
 * @property CarbonImmutable|null $closed_at
 * @property string|null $closed_by_user_id
 * @property string|null $assignee_user_id
 * @property CarbonImmutable|null $counterpart_muted_until
 * @property string|null $counterpart_muted_reason
 * @property CarbonImmutable|null $retention_until
 * @property CarbonImmutable|null $content_purged_at
 * @property-read Collection<int, ConversationParticipant> $participants
 * @property-read Collection<int, ConversationMessage> $messages
 * @property-read ConversationMessage|null $latestMessage
 */
final class Conversation extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<ConversationParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    /**
     * @return HasMany<ConversationMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class)->orderBy('sent_at');
    }

    /**
     * @return HasOne<ConversationMessage, $this>
     */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(ConversationMessage::class)->latestOfMany('sent_at');
    }

    protected function casts(): array
    {
        return [
            'kind' => ConversationKind::class,
            'status' => ConversationStatus::class,
            'last_author_side' => MessageSide::class,
            'last_message_at' => PreciseTimestamp::class,
            'closed_at' => PreciseTimestamp::class,
            'counterpart_muted_until' => PreciseTimestamp::class,
            'retention_until' => PreciseTimestamp::class,
            'content_purged_at' => PreciseTimestamp::class,
        ];
    }
}

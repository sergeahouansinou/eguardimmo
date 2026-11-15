<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $subject
 * @property string $created_by_user_id
 * @property Carbon $last_message_at
 * @property string $last_author_user_id
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
        return ['last_message_at' => 'datetime'];
    }
}

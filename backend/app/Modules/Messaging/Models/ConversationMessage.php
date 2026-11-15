<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Identity\Models\User;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $conversation_id
 * @property string $author_user_id
 * @property string $body
 * @property Carbon $sent_at
 * @property-read User $author
 * @property-read Conversation $conversation
 * @property-read Collection<int, ConversationAttachment> $attachments
 */
final class ConversationMessage extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id')->withTrashed();
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return HasMany<ConversationAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(ConversationAttachment::class);
    }

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }
}

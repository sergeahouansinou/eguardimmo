<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\MessageSide;
use App\Shared\Audit\Auditable;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $conversation_id
 * @property string $author_user_id
 * @property string $body
 * @property CarbonImmutable $sent_at
 * @property MessageSide $author_side
 * @property string|null $client_id
 * @property CarbonImmutable|null $redacted_at
 * @property string|null $redacted_by_user_id
 * @property string|null $redaction_reason
 * @property-read User $author
 * @property-read Conversation $conversation
 * @property-read Collection<int, ConversationAttachment> $attachments
 */
final class ConversationMessage extends Model
{
    use Auditable;
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

    /**
     * Le texte des échanges ne se recopie jamais dans le journal (ADR 0033).
     *
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['body', 'redaction_reason'];
    }

    public function isRedacted(): bool
    {
        return $this->redacted_at !== null;
    }

    protected function casts(): array
    {
        return [
            'sent_at' => PreciseTimestamp::class,
            'redacted_at' => PreciseTimestamp::class,
            'author_side' => MessageSide::class,
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Identity\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $support_ticket_id
 * @property string $author_user_id
 * @property bool $from_support
 * @property bool $internal
 * @property string $body
 * @property string|null $client_id
 * @property Carbon $sent_at
 * @property-read User $author
 * @property-read SupportTicket $ticket
 * @property-read Collection<int, SupportAttachment> $attachments
 */
final class SupportTicketMessage extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id')->withTrashed();
    }

    /**
     * @return BelongsTo<SupportTicket, $this>
     */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    /**
     * @return HasMany<SupportAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(SupportAttachment::class);
    }

    protected function casts(): array
    {
        return [
            'from_support' => 'boolean',
            'internal' => 'boolean',
            'sent_at' => 'datetime',
        ];
    }
}

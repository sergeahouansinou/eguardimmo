<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\RequesterSpace;
use App\Modules\Messaging\Enums\TicketCategory;
use App\Modules\Messaging\Enums\TicketPriority;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Shared\Audit\Auditable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $reference
 * @property string $requester_user_id
 * @property string|null $organization_id
 * @property string|null $organization_name
 * @property RequesterSpace $space
 * @property TicketCategory $category
 * @property string $subject
 * @property TicketPriority $priority
 * @property TicketStatus $status
 * @property string|null $assignee_user_id
 * @property Carbon|null $first_response_at
 * @property Carbon|null $resolved_at
 * @property Carbon $last_activity_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $requester
 * @property-read User|null $assignee
 * @property-read Collection<int, SupportTicketMessage> $messages
 */
final class SupportTicket extends Model
{
    use Auditable;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_user_id')->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id')->withTrashed();
    }

    /**
     * @return HasMany<SupportTicketMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class)->orderBy('sent_at');
    }

    /**
     * @return HasMany<SupportAccessGrant, $this>
     */
    public function accessGrants(): HasMany
    {
        return $this->hasMany(SupportAccessGrant::class);
    }

    protected function casts(): array
    {
        return [
            'space' => RequesterSpace::class,
            'category' => TicketCategory::class,
            'priority' => TicketPriority::class,
            'status' => TicketStatus::class,
            'first_response_at' => 'datetime',
            'resolved_at' => 'datetime',
            'last_activity_at' => 'datetime',
        ];
    }
}

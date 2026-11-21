<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\EmergencyBasis;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Donnée de plateforme : `organization_id` désigne l'organisation dont les données sont lues, il ne cloisonne pas la ligne ; chaque
 * requête filtre l'organisation explicitement.
 *
 * @property string $id
 * @property string $support_ticket_id
 * @property string $operator_user_id
 * @property string|null $organization_id
 * @property SupportAccessKind $kind
 * @property list<string> $scopes
 * @property SupportAccessStatus $status
 * @property EmergencyBasis|null $emergency_basis
 * @property string $reason
 * @property int $duration_hours
 * @property Carbon|null $requested_at
 * @property string|null $decided_by_user_id
 * @property Carbon|null $decided_at
 * @property Carbon|null $granted_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $revoked_at
 * @property string|null $revoked_by_user_id
 * @property string|null $reviewed_by_user_id
 * @property Carbon|null $reviewed_at
 * @property int $read_count
 * @property-read SupportTicket $ticket
 * @property-read User $operator
 */
final class SupportAccessGrant extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /**
     * @return BelongsTo<SupportTicket, $this>
     */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_user_id')->withTrashed();
    }

    public function isLive(): bool
    {
        return $this->status === SupportAccessStatus::Active && $this->expires_at?->isFuture() === true;
    }

    protected function casts(): array
    {
        return [
            'kind' => SupportAccessKind::class,
            'status' => SupportAccessStatus::class,
            'emergency_basis' => EmergencyBasis::class,
            'scopes' => 'array',
            'requested_at' => 'datetime',
            'decided_at' => 'datetime',
            'granted_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'read_count' => 'integer',
            'duration_hours' => 'integer',
        ];
    }
}

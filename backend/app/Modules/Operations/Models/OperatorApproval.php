<?php

declare(strict_types=1);

namespace App\Modules\Operations\Models;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Enums\ApprovableAction;
use App\Modules\Operations\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Donnée de plateforme : `organization_id` désigne l'organisation concernée par l'action, il ne cloisonne pas la ligne.
 *
 * @property string $id
 * @property ApprovableAction $action
 * @property string $subject_type
 * @property string $subject_id
 * @property string|null $organization_id
 * @property array<string, mixed> $payload
 * @property string $reason
 * @property string|null $ticket_reference
 * @property string $requested_by_user_id
 * @property string $requested_proof
 * @property ApprovalStatus $status
 * @property string|null $decided_by_user_id
 * @property string|null $decided_proof
 * @property Carbon|null $decided_at
 * @property Carbon|null $executed_at
 * @property string|null $failure_code
 * @property Carbon $expires_at
 * @property int $lock_version
 * @property Carbon $created_at
 * @property-read User $requester
 * @property-read User|null $decider
 */
final class OperatorApproval extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'lock_version' => 0,
        'decided_by_user_id' => null,
        'decided_proof' => null,
        'decided_at' => null,
        'executed_at' => null,
        'failure_code' => null,
        'ticket_reference' => null,
        'organization_id' => null,
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id')->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by_user_id')->withTrashed();
    }

    public function isLivePending(): bool
    {
        return $this->status === ApprovalStatus::Pending && $this->expires_at->isFuture();
    }

    protected function casts(): array
    {
        return [
            'action' => ApprovableAction::class,
            'status' => ApprovalStatus::class,
            'payload' => 'array',
            'reason' => 'encrypted',
            'decided_at' => 'datetime',
            'executed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }
}

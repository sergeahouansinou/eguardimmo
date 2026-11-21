<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Models;

use App\Modules\Privacy\Enums\ExtensionReason;
use App\Modules\Privacy\Enums\RefusalReason;
use App\Modules\Privacy\Enums\RequestChannel;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Enums\VerificationMethod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string|null $requester_user_id
 * @property string|null $requester_email
 * @property string|null $requester_email_fingerprint
 * @property RequestKind $kind
 * @property RequestChannel $channel
 * @property Carbon $received_at
 * @property Carbon $due_at
 * @property Carbon|null $extended_until
 * @property ExtensionReason|null $extension_reason
 * @property VerificationMethod|null $identity_verified_by
 * @property Carbon|null $identity_verified_at
 * @property string|null $handled_by_user_id
 * @property RequestStatus $status
 * @property RefusalReason|null $refusal_reason
 * @property int $forwarded_count
 * @property string|null $export_path
 * @property Carbon|null $export_generated_at
 * @property Carbon|null $export_expires_at
 * @property Carbon|null $export_downloaded_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $overdue_flagged_at
 * @property Carbon $created_at
 * @property-read Collection<int, PrivacyRequestEvent> $events
 */
final class PrivacyRequest extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'requester_user_id' => null,
        'requester_email' => null,
        'requester_email_fingerprint' => null,
        'extended_until' => null,
        'extension_reason' => null,
        'identity_verified_by' => null,
        'identity_verified_at' => null,
        'handled_by_user_id' => null,
        'refusal_reason' => null,
        'forwarded_count' => 0,
        'export_path' => null,
        'export_generated_at' => null,
        'export_expires_at' => null,
        'export_downloaded_at' => null,
        'completed_at' => null,
        'overdue_flagged_at' => null,
    ];

    /**
     * @return HasMany<PrivacyRequestEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(PrivacyRequestEvent::class)->orderBy('occurred_at');
    }

    public function effectiveDueAt(): Carbon
    {
        return $this->extended_until ?? $this->due_at;
    }

    public function isOverdue(): bool
    {
        return $this->status->isOpen() && $this->effectiveDueAt()->isPast();
    }

    public function isIdentityVerified(): bool
    {
        return $this->identity_verified_by !== null;
    }

    public function hasExport(): bool
    {
        return $this->export_path !== null;
    }

    protected function casts(): array
    {
        return [
            'requester_email' => 'encrypted',
            'kind' => RequestKind::class,
            'channel' => RequestChannel::class,
            'status' => RequestStatus::class,
            'extension_reason' => ExtensionReason::class,
            'identity_verified_by' => VerificationMethod::class,
            'refusal_reason' => RefusalReason::class,
            'received_at' => 'datetime',
            'due_at' => 'datetime',
            'extended_until' => 'datetime',
            'identity_verified_at' => 'datetime',
            'export_generated_at' => 'datetime',
            'export_expires_at' => 'datetime',
            'export_downloaded_at' => 'datetime',
            'completed_at' => 'datetime',
            'overdue_flagged_at' => 'datetime',
            'forwarded_count' => 'integer',
        ];
    }
}

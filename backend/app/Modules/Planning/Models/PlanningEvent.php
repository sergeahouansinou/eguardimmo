<?php

declare(strict_types=1);

namespace App\Modules\Planning\Models;

use App\Modules\Planning\Database\Factories\PlanningEventFactory;
use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * `start_time` et `timezone` vont ensemble : un événement sans heure dure la journée et n'a pas de fuseau.
 *
 * @property string $id
 * @property string $organization_id
 * @property EventKind $kind
 * @property string $title
 * @property string|null $notes
 * @property Carbon $starts_on
 * @property string|null $start_time
 * @property string|null $timezone
 * @property Recurrence $recurrence
 * @property Carbon|null $recurrence_until
 * @property int|null $reminder_offset_minutes
 * @property CarbonInterface|null $next_reminder_at
 * @property string|null $property_id
 * @property string|null $unit_id
 * @property string|null $lease_id
 * @property string $created_by_user_id
 * @property Carbon|null $cancelled_at
 * @property int $lock_version
 */
#[UseFactory(PlanningEventFactory::class)]
final class PlanningEvent extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<PlanningEventFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['title', 'notes'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['next_reminder_at'];
    }

    /**
     * @return HasMany<PlanningEventAttendee, $this>
     */
    public function attendees(): HasMany
    {
        return $this->hasMany(PlanningEventAttendee::class, 'event_id');
    }

    public function isAllDay(): bool
    {
        return $this->start_time === null;
    }

    protected function casts(): array
    {
        return [
            'kind' => EventKind::class,
            'recurrence' => Recurrence::class,
            'starts_on' => 'date:Y-m-d',
            'recurrence_until' => 'date:Y-m-d',
            'reminder_offset_minutes' => 'integer',
            'next_reminder_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'lock_version' => 'integer',
        ];
    }
}

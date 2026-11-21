<?php

declare(strict_types=1);

namespace App\Modules\Planning\Models;

use App\Modules\Planning\Database\Factories\PlanningTaskFactory;
use App\Modules\Planning\Enums\TaskStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * « En retard » se calcule (`due_on` passée dans le fuseau de l'organisation) : jamais stocké.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $title
 * @property Carbon $due_on
 * @property string|null $assignee_user_id
 * @property TaskStatus $status
 * @property Carbon|null $done_at
 * @property string|null $done_by_user_id
 * @property int|null $remind_days_before
 * @property CarbonInterface|null $next_reminder_at
 * @property string|null $property_id
 * @property string|null $unit_id
 * @property string|null $lease_id
 * @property string|null $client_id
 * @property string $created_by_user_id
 * @property int $lock_version
 */
#[UseFactory(PlanningTaskFactory::class)]
final class PlanningTask extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<PlanningTaskFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['title'];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['next_reminder_at'];
    }

    protected function casts(): array
    {
        return [
            'due_on' => 'date:Y-m-d',
            'status' => TaskStatus::class,
            'done_at' => 'datetime',
            'remind_days_before' => 'integer',
            'next_reminder_at' => 'datetime',
            'lock_version' => 'integer',
        ];
    }
}

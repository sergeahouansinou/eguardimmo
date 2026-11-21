<?php

declare(strict_types=1);

namespace App\Modules\Operations\Models;

use App\Modules\Operations\Enums\TaskStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * État technique de la dernière exécution d'une commande planifiée : hors `Auditable`, hors organisation.
 *
 * @property string $id
 * @property string $command
 * @property string $expression
 * @property Carbon $last_started_at
 * @property Carbon|null $last_finished_at
 * @property int|null $last_duration_ms
 * @property TaskStatus $last_status
 * @property Carbon|null $last_failed_at
 * @property string|null $last_error_class
 */
final class ScheduledTaskRun extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'last_finished_at' => null,
        'last_duration_ms' => null,
        'last_failed_at' => null,
        'last_error_class' => null,
    ];

    protected function casts(): array
    {
        return [
            'last_status' => TaskStatus::class,
            'last_started_at' => 'datetime',
            'last_finished_at' => 'datetime',
            'last_failed_at' => 'datetime',
            'last_duration_ms' => 'integer',
        ];
    }
}

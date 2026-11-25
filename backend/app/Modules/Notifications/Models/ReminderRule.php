<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use App\Modules\Notifications\Enums\ReminderCode;
use App\Shared\Audit\PreciseTimestamp;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Réglage d'un rappel ; sans ligne, les valeurs du catalogue s'appliquent et le rappel est désactivé.
 *
 * @property string $id
 * @property ReminderCode $code
 * @property bool $enabled
 * @property int $delay_days
 * @property int|null $repeat_every_days
 * @property int $max_occurrences
 * @property list<string> $channels
 * @property string|null $updated_by_user_id
 * @property CarbonImmutable|null $last_run_at
 * @property int|null $last_sent_count
 * @property CarbonImmutable|null $updated_at
 */
final class ReminderRule extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'code' => ReminderCode::class,
            'enabled' => 'boolean',
            'delay_days' => 'integer',
            'repeat_every_days' => 'integer',
            'max_occurrences' => 'integer',
            'channels' => 'array',
            'last_run_at' => PreciseTimestamp::class,
            'last_sent_count' => 'integer',
            'updated_at' => 'immutable_datetime',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $provider
 * @property string $event_id
 * @property string $type
 * @property string|null $delivery_id
 * @property CarbonImmutable $received_at
 */
final class MailProviderEvent extends Model
{
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['received_at' => 'immutable_datetime'];
    }
}

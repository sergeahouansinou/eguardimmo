<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Models;

use App\Modules\Privacy\Enums\EventKind;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Journal de preuve en ajout seul (déclencheurs ADR 0017) : ni adresse, ni nom, ni texte libre.
 *
 * @property string $id
 * @property string $privacy_request_id
 * @property EventKind $kind
 * @property string|null $actor_user_id
 * @property array<string, scalar|null> $metadata
 * @property Carbon $occurred_at
 */
final class PrivacyRequestEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = ['actor_user_id' => null];

    protected function casts(): array
    {
        return [
            'kind' => EventKind::class,
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}

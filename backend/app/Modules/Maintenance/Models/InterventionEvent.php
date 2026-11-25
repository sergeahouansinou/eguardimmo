<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\EventKind;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property EventKind $kind
 * @property ActorKind $actor_kind
 * @property string|null $actor_user_id
 * @property string|null $text
 * @property array<string, mixed>|null $metadata
 * @property string|null $idempotency_key
 * @property bool $visible_to_owner
 * @property bool $visible_to_tenant
 * @property Carbon $created_at
 */
final class InterventionEvent extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'kind' => EventKind::class,
            'actor_kind' => ActorKind::class,
            'metadata' => 'array',
            'visible_to_owner' => 'boolean',
            'visible_to_tenant' => 'boolean',
        ];
    }
}

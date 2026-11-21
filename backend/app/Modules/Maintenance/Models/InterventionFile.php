<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $intervention_id
 * @property string $stored_file_id
 * @property FileKind $kind
 * @property ActorKind $uploaded_by_kind
 * @property string|null $uploaded_by_user_id
 * @property bool $visible_to_owner
 * @property bool $visible_to_tenant
 * @property Carbon|null $created_at
 */
final class InterventionFile extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'kind' => FileKind::class,
            'uploaded_by_kind' => ActorKind::class,
            'visible_to_owner' => 'boolean',
            'visible_to_tenant' => 'boolean',
        ];
    }
}

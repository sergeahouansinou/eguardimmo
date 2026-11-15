<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $term_id
 * @property array<string, string>|null $labels
 * @property bool $hidden
 * @property int|null $position
 */
final class TermOverride extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'labels' => 'array',
            'hidden' => 'boolean',
            'position' => 'integer',
        ];
    }
}

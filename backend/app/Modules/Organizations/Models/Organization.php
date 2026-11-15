<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Models;

use App\Modules\Organizations\Database\Factories\OrganizationFactory;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Shared\Audit\Auditable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property OrganizationKind $kind
 * @property string $name
 * @property string $country
 * @property bool $two_factor_required
 * @property string $created_by_user_id
 * @property Carbon $created_at
 */
#[UseFactory(OrganizationFactory::class)]
final class Organization extends Model
{
    use Auditable;

    /** @use HasFactory<OrganizationFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'kind' => OrganizationKind::class,
            'two_factor_required' => 'boolean',
        ];
    }
}

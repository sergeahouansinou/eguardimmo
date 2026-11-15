<?php

declare(strict_types=1);

namespace App\Modules\Properties\Models;

use App\Modules\Properties\Database\Factories\UnitOwnershipFactory;
use App\Modules\Properties\Enums\OwnershipNature;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Période semi-ouverte : [valid_from, valid_to).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $unit_id
 * @property string $party_id
 * @property int $share_bp
 * @property OwnershipNature $nature
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 */
#[UseFactory(UnitOwnershipFactory::class)]
final class UnitOwnership extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<UnitOwnershipFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'share_bp' => 'integer',
            'nature' => OwnershipNature::class,
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
        ];
    }
}

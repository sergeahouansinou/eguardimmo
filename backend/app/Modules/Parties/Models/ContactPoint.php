<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Modules\Parties\Enums\ContactPointType;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $party_id
 * @property ContactPointType $type
 * @property string|null $value
 * @property string|null $label
 * @property bool $is_primary
 * @property int|null $primary_slot
 */
final class ContactPoint extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['value', 'label'];
    }

    protected function casts(): array
    {
        return [
            'type' => ContactPointType::class,
            'is_primary' => 'boolean',
            'primary_slot' => 'integer',
        ];
    }
}

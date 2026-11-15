<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Modules\Parties\Enums\IdentifierScheme;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $party_id
 * @property IdentifierScheme $scheme
 * @property string $country
 * @property string|null $value
 * @property string|null $value_hash
 */
final class PartyIdentifier extends Model
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
        return ['value', 'value_hash'];
    }

    protected function casts(): array
    {
        return [
            'scheme' => IdentifierScheme::class,
            'value' => 'encrypted',
        ];
    }
}

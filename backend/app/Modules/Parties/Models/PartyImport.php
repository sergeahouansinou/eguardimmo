<?php

declare(strict_types=1);

namespace App\Modules\Parties\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Trace d'un import, pour le rejouer par `client_id` sans rien recréer.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $client_id
 * @property string $payload_hash
 * @property list<string> $party_ids
 * @property int $row_count
 */
final class PartyImport extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['party_ids' => 'array', 'row_count' => 'integer'];
    }
}

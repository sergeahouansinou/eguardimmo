<?php

declare(strict_types=1);

namespace App\Modules\Properties\Models;

use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Lien entre un site (ou l'un de ses lots) et une fiche de contact. `unit_key` est une colonne générée : jamais écrite.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $property_id
 * @property string|null $unit_id
 * @property string $unit_key
 * @property string $party_id
 * @property string|null $contact_category_term_id
 * @property Carbon $created_at
 */
final class PropertyContact extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id', 'unit_key'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['unit_key'];
    }

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Models;

use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $party_id
 * @property SupplierStatus $status
 * @property bool $preferred
 * @property int|null $payment_terms_days
 * @property string|null $internal_note
 * @property array<string, mixed>|null $custom_fields
 * @property int $lock_version
 */
final class SupplierProfile extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<SupplierTrade, $this>
     */
    public function trades(): HasMany
    {
        return $this->hasMany(SupplierTrade::class, 'supplier_profile_id')->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['internal_note', 'custom_fields'];
    }

    protected function casts(): array
    {
        return [
            'status' => SupplierStatus::class,
            'preferred' => 'boolean',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
        ];
    }
}

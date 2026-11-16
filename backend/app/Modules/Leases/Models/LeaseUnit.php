<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Database\Factories\LeaseUnitFactory;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Période semi-ouverte : [valid_from, valid_to). `main_of_lease` est une colonne générée : jamais écrite.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $unit_id
 * @property bool $is_main
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 * @property-read Lease $lease
 */
#[UseFactory(LeaseUnitFactory::class)]
final class LeaseUnit extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<LeaseUnitFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'unit_id', 'is_main', 'valid_from', 'valid_to'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['main_of_lease'];
    }

    /**
     * @return BelongsTo<Lease, $this>
     */
    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    protected function casts(): array
    {
        return [
            'is_main' => 'boolean',
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
        ];
    }
}

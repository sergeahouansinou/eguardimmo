<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Models;

use App\Modules\Mandates\Database\Factories\MandateUnitFactory;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Période semi-ouverte : [valid_from, valid_to) ; sans `valid_to`, le lot suit la fin du mandat.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $mandate_id
 * @property string $unit_id
 * @property Carbon $valid_from
 * @property Carbon|null $valid_to
 * @property-read Mandate $mandate
 */
#[UseFactory(MandateUnitFactory::class)]
final class MandateUnit extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<MandateUnitFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['mandate_id', 'unit_id', 'valid_from', 'valid_to'];

    /**
     * @return BelongsTo<Mandate, $this>
     */
    public function mandate(): BelongsTo
    {
        return $this->belongsTo(Mandate::class);
    }

    protected function casts(): array
    {
        return [
            'valid_from' => 'date:Y-m-d',
            'valid_to' => 'date:Y-m-d',
        ];
    }
}

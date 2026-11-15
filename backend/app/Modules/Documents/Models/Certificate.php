<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Modules\Documents\Support\DateOnlyCast;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $subject_type
 * @property string $subject_id
 * @property string $certificate_type_term_id
 * @property string|null $reference
 * @property string|null $issuer_party_id
 * @property CarbonImmutable $issued_on
 * @property CarbonImmutable|null $expires_on
 * @property array<string, mixed> $data
 * @property string|null $stored_file_id
 * @property string|null $replaces_id
 * @property Carbon $created_at
 * @property Certificate|null $replacement
 */
final class Certificate extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasOne<Certificate, $this>
     */
    public function replacement(): HasOne
    {
        return $this->hasOne(self::class, 'replaces_id');
    }

    protected function casts(): array
    {
        return [
            'issued_on' => DateOnlyCast::class,
            'expires_on' => DateOnlyCast::class,
            'data' => 'array',
        ];
    }
}

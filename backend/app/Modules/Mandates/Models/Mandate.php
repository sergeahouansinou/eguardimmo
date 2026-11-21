<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Models;

use App\Modules\Mandates\Database\Factories\MandateFactory;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Période semi-ouverte : le mandat couvre [starts_on, ends_on).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $reference
 * @property string $mandant_party_id
 * @property string $mandate_type_term_id
 * @property MandateStatus $status
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property bool $tacit_renewal
 * @property int $renewal_months
 * @property int $notice_months
 * @property non-empty-string $currency
 * @property Carbon|null $signed_on
 * @property string|null $signed_file_id
 * @property Carbon|null $notice_given_on
 * @property string|null $termination_reason
 * @property string|null $termination_note
 * @property array<string, mixed> $custom_fields
 * @property string|null $note
 * @property int $lock_version
 * @property Carbon|null $archived_at
 * @property string|null $created_by_user_id
 */
#[UseFactory(MandateFactory::class)]
final class Mandate extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<MandateFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'reference', 'mandant_party_id', 'mandate_type_term_id', 'status', 'starts_on', 'ends_on', 'tacit_renewal',
        'renewal_months', 'notice_months', 'currency', 'signed_on', 'signed_file_id', 'notice_given_on', 'termination_reason',
        'termination_note', 'custom_fields', 'note', 'lock_version', 'archived_at', 'created_by_user_id',
    ];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['note', 'termination_note', 'custom_fields'];
    }

    /**
     * @return HasMany<MandateUnit, $this>
     */
    public function units(): HasMany
    {
        return $this->hasMany(MandateUnit::class);
    }

    /**
     * @return HasMany<MandateTerm, $this>
     */
    public function terms(): HasMany
    {
        return $this->hasMany(MandateTerm::class);
    }

    protected function casts(): array
    {
        return [
            'status' => MandateStatus::class,
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'tacit_renewal' => 'boolean',
            'renewal_months' => 'integer',
            'notice_months' => 'integer',
            'signed_on' => 'date:Y-m-d',
            'notice_given_on' => 'date:Y-m-d',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
            'archived_at' => 'datetime',
        ];
    }
}

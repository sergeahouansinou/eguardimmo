<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Modules\Leases\Database\Factories\LeaseFactory;
use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Enums\PaymentMethod;
use App\Modules\Leases\Enums\Periodicity;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * `ends_on` est exclu : le bail couvre [starts_on, ends_on).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $reference
 * @property string $jurisdiction
 * @property string $regime_key
 * @property LeaseStatus $status
 * @property Carbon $starts_on
 * @property int $duration_months
 * @property bool $tacit_renewal
 * @property Carbon|null $ends_on
 * @property int $due_day
 * @property Periodicity $periodicity
 * @property BillingTiming $billing_timing
 * @property string $currency
 * @property PaymentMethod|null $payment_method
 * @property Carbon|null $signed_on
 * @property string|null $signed_file_id
 * @property Carbon|null $notice_received_on
 * @property NoticeGivenBy|null $notice_given_by
 * @property Carbon|null $notice_departure_on
 * @property string|null $termination_reason
 * @property array<string, mixed> $jurisdiction_data
 * @property array<string, mixed> $custom_fields
 * @property string|null $note
 * @property int $lock_version
 * @property Carbon|null $archived_at
 * @property string|null $created_by_user_id
 */
#[UseFactory(LeaseFactory::class)]
final class Lease extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<LeaseFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'reference', 'jurisdiction', 'regime_key', 'status', 'starts_on', 'duration_months', 'tacit_renewal', 'ends_on', 'due_day',
        'periodicity', 'billing_timing', 'currency', 'payment_method', 'signed_on', 'signed_file_id', 'notice_received_on',
        'notice_given_by', 'notice_departure_on', 'termination_reason', 'jurisdiction_data', 'custom_fields', 'note',
        'lock_version', 'archived_at', 'created_by_user_id',
    ];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['note', 'termination_reason', 'custom_fields'];
    }

    /**
     * Fin effective (exclue) : la plus proche de `ends_on` et du départ préavisé ; null si le bail est sans fin.
     */
    public function effectiveEnd(): ?string
    {
        $fins = array_filter([$this->ends_on?->toDateString(), $this->notice_departure_on?->toDateString()]);

        return $fins === [] ? null : min($fins);
    }

    /**
     * @return HasMany<LeaseUnit, $this>
     */
    public function units(): HasMany
    {
        return $this->hasMany(LeaseUnit::class);
    }

    /**
     * @return HasMany<LeaseParty, $this>
     */
    public function parties(): HasMany
    {
        return $this->hasMany(LeaseParty::class);
    }

    /**
     * @return HasMany<LeaseTerm, $this>
     */
    public function terms(): HasMany
    {
        return $this->hasMany(LeaseTerm::class);
    }

    protected function casts(): array
    {
        return [
            'status' => LeaseStatus::class,
            'starts_on' => 'date:Y-m-d',
            'duration_months' => 'integer',
            'tacit_renewal' => 'boolean',
            'ends_on' => 'date:Y-m-d',
            'due_day' => 'integer',
            'periodicity' => Periodicity::class,
            'billing_timing' => BillingTiming::class,
            'payment_method' => PaymentMethod::class,
            'signed_on' => 'date:Y-m-d',
            'notice_received_on' => 'date:Y-m-d',
            'notice_given_by' => NoticeGivenBy::class,
            'notice_departure_on' => 'date:Y-m-d',
            'jurisdiction_data' => 'array',
            'custom_fields' => 'array',
            'lock_version' => 'integer',
            'archived_at' => 'datetime',
        ];
    }
}

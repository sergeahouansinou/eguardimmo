<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Models;

use App\Modules\Bookings\Database\Factories\BookingFactory;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * `check_in` et `check_out` restent des chaînes `Y-m-d` (départ exclusif) : un cast date les écrirait avec une heure et fausserait les comparaisons.
 *
 * @property string $id
 * @property string $reference
 * @property string $organization_id
 * @property string $listing_id
 * @property string $user_id
 * @property string $check_in
 * @property string $check_out
 * @property int $nights
 * @property int $guests
 * @property int $nightly_minor
 * @property int $subtotal_minor
 * @property int $service_fee_minor
 * @property int $total_minor
 * @property string $currency
 * @property CancellationPolicy $cancellation_policy
 * @property BookingStatus $status
 * @property Carbon|null $expires_at
 * @property Carbon|null $confirmed_at
 * @property Carbon|null $cancelled_at
 * @property string|null $cancel_reason
 * @property int|null $refund_minor
 * @property string $idempotency_key
 * @property string $fingerprint
 */
#[UseFactory(BookingFactory::class)]
final class Booking extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<BookingFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'status' => BookingStatus::class,
            'cancellation_policy' => CancellationPolicy::class,
            'nights' => 'integer',
            'guests' => 'integer',
            'nightly_minor' => 'integer',
            'subtotal_minor' => 'integer',
            'service_fee_minor' => 'integer',
            'total_minor' => 'integer',
            'refund_minor' => 'integer',
            'expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }
}

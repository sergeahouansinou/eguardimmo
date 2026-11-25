<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Database\Factories;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Listings\Enums\CancellationPolicy;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Booking>
 */
final class BookingFactory extends Factory
{
    protected $model = Booking::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reference' => 'SB-2026-'.fake()->unique()->numerify('######'),
            'listing_id' => (string) fake()->uuid(),
            'user_id' => (string) fake()->uuid(),
            'check_in' => '2027-03-10',
            'check_out' => '2027-03-13',
            'nights' => 3,
            'guests' => 2,
            'nightly_minor' => 9000,
            'subtotal_minor' => 27000,
            'service_fee_minor' => 0,
            'total_minor' => 27000,
            'currency' => 'EUR',
            'cancellation_policy' => CancellationPolicy::Moderate,
            'status' => BookingStatus::Confirmed,
            'idempotency_key' => fake()->unique()->bothify('key-########'),
            'fingerprint' => hash('sha256', (string) fake()->unique()->numerify('######')),
        ];
    }

    public function pending(int $minutes = 30): self
    {
        return $this->state(fn (): array => ['status' => BookingStatus::PendingPayment, 'expires_at' => now()->addMinutes($minutes)]);
    }
}

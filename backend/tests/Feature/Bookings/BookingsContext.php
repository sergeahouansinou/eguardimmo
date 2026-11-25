<?php

declare(strict_types=1);

namespace Tests\Feature\Bookings;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Listings\Models\Listing;
use App\Modules\Organizations\Models\Organization;
use Tests\Feature\Properties\PropertiesContext as C;

final class BookingsContext
{
    public const string AUJOURDHUI = '2026-11-21 10:00:00';

    /**
     * @param  array<string, mixed>  $corps
     * @return array<string, mixed>
     */
    public static function corps(Listing $annonce, array $corps = []): array
    {
        return ['listing_ref' => $annonce->public_ref, 'check_in' => '2026-12-10', 'check_out' => '2026-12-13', 'guests' => 2, ...$corps];
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function reservation(Organization $organisation, Listing $annonce, string $userId, array $attributs = []): Booking
    {
        return C::dans($organisation, fn (): Booking => Booking::factory()->create([
            'listing_id' => $annonce->id,
            'user_id' => $userId,
            ...$attributs,
        ]));
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function enAttente(Organization $organisation, Listing $annonce, string $userId, array $attributs = []): Booking
    {
        return self::reservation($organisation, $annonce, $userId, [
            'status' => BookingStatus::PendingPayment,
            'expires_at' => now()->addMinutes(30),
            ...$attributs,
        ]);
    }
}

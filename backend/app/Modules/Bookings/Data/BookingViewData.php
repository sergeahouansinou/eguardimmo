<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Data;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Listings\Data\ListingSummaryData;
use App\Modules\Listings\Enums\CancellationPolicy;
use Carbon\CarbonImmutable;

final readonly class BookingViewData
{
    public function __construct(
        public string $id,
        public string $reference,
        public ?ListingSummaryData $listing,
        public string $checkIn,
        public string $checkOut,
        public int $nights,
        public int $guests,
        public int $nightlyMinor,
        public int $subtotalMinor,
        public int $serviceFeeMinor,
        public int $totalMinor,
        public string $currency,
        public CancellationPolicy $cancellationPolicy,
        public BookingStatus $status,
        public ?CarbonImmutable $expiresAt,
        public ?CarbonImmutable $confirmedAt,
        public ?CarbonImmutable $cancelledAt,
        public ?string $cancelReason,
        public ?int $refundMinor,
        public ?string $travelerFirstName,
    ) {}
}

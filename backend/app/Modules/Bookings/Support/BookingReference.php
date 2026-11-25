<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Support;

use App\Shared\Database\ContinuousCounter;

/**
 * SB-AAAA-NNNNNN : séquence continue par année. À appeler dans la transaction de création : son annulation libère le numéro.
 */
final readonly class BookingReference
{
    public function __construct(private ContinuousCounter $compteur) {}

    public function next(int $annee): string
    {
        return sprintf('SB-%04d-%06d', $annee, $this->compteur->next('booking_sequences', ['year' => $annee]));
    }
}

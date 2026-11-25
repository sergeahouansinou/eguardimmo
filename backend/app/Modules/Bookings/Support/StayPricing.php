<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Support;

use App\Modules\Bookings\Data\PricingData;
use App\Modules\Bookings\Enums\ErrorCode;
use App\Modules\Listings\Data\ListingBookingData;
use App\Modules\Listings\Enums\ListingKind;

/**
 * Seul endroit où un total se calcule : le client ne fournit que des dates et un nombre de voyageurs.
 */
final class StayPricing
{
    public function price(ListingBookingData $annonce, string $arrivee, string $depart, int $voyageurs): PricingData
    {
        if ($annonce->kind !== ListingKind::ShortStay) {
            throw ErrorCode::ListingNotBookable->problem();
        }

        $nuits = (int) Calendar::date($arrivee)->diffInDays(Calendar::date($depart));

        if ($nuits > $this->maxNights()) {
            throw ErrorCode::StayTooLong->problem();
        }

        if ($nuits < $annonce->minNights) {
            throw ErrorCode::MinNightsNotMet->problem("Ce logement se réserve pour {$annonce->minNights} nuit(s) au minimum.");
        }

        if ($voyageurs > $annonce->capacity) {
            throw ErrorCode::GuestsExceedCapacity->problem();
        }

        $sousTotal = $nuits * $annonce->priceMinor;
        $frais = intdiv($sousTotal * $this->feeBasisPoints(), 10000);

        return new PricingData($nuits, $annonce->priceMinor, $sousTotal, $frais, $sousTotal + $frais, $annonce->currency, $annonce->cancellationPolicy);
    }

    private function feeBasisPoints(): int
    {
        $valeur = config('marketplace.service_fee_basis_points');

        return is_int($valeur) ? max(0, min(10000, $valeur)) : 0;
    }

    private function maxNights(): int
    {
        $valeur = config('marketplace.max_nights');

        return is_int($valeur) && $valeur > 0 ? $valeur : 90;
    }
}

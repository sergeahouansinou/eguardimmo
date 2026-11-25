<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case BookingNotFound = 'booking_not_found';
    case DatesUnavailable = 'dates_unavailable';
    case BookingNotCancellable = 'booking_not_cancellable';
    case BookingNotConfirmable = 'booking_not_confirmable';
    case ListingNotBookable = 'listing_not_bookable';
    case MinNightsNotMet = 'min_nights_not_met';
    case StayTooLong = 'stay_too_long';
    case GuestsExceedCapacity = 'guests_exceed_capacity';
    case IdempotencyKeyRequired = 'bookings_idempotency_key_required';
    case IdempotencyKeyReused = 'idempotency_key_reused';
    case PendingBookingExists = 'pending_booking_exists';
    case TooManyPendingBookings = 'too_many_pending_bookings';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::BookingNotFound => 404,
            self::ListingNotBookable, self::MinNightsNotMet, self::StayTooLong, self::GuestsExceedCapacity, self::IdempotencyKeyRequired => 422,
            self::DatesUnavailable, self::BookingNotCancellable, self::BookingNotConfirmable, self::IdempotencyKeyReused, self::PendingBookingExists, self::TooManyPendingBookings => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::BookingNotFound => 'Réservation introuvable',
            self::DatesUnavailable => 'Dates indisponibles',
            self::BookingNotCancellable => 'Annulation impossible',
            self::BookingNotConfirmable => 'Confirmation impossible',
            self::ListingNotBookable => 'Annonce non réservable',
            self::MinNightsNotMet => 'Séjour trop court',
            self::StayTooLong => 'Séjour trop long',
            self::GuestsExceedCapacity => 'Trop de voyageurs',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence manquante',
            self::IdempotencyKeyReused => 'Clé d\'idempotence réutilisée',
            self::PendingBookingExists => 'Réservation déjà en attente',
            self::TooManyPendingBookings => 'Trop de réservations en attente',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::BookingNotFound => 'Cette réservation n\'existe pas.',
            self::DatesUnavailable => 'Ces dates ne sont plus disponibles pour ce logement : choisissez d\'autres dates.',
            self::BookingNotCancellable => 'Cette réservation ne peut plus être annulée : elle est déjà annulée ou terminée, ou le séjour a commencé.',
            self::BookingNotConfirmable => 'Cette réservation ne peut plus être confirmée : le délai de paiement est dépassé ou elle est annulée.',
            self::ListingNotBookable => 'Seuls les séjours de courte durée se réservent en ligne.',
            self::MinNightsNotMet => 'Ce logement exige un nombre minimal de nuits.',
            self::StayTooLong => 'Un séjour ne peut pas dépasser 90 nuits.',
            self::GuestsExceedCapacity => 'Le nombre de voyageurs dépasse la capacité du logement.',
            self::IdempotencyKeyRequired => 'L\'en-tête Idempotency-Key est obligatoire (8 à 64 caractères : lettres, chiffres, . _ : -).',
            self::IdempotencyKeyReused => 'Cette clé a déjà servi pour une demande différente.',
            self::PendingBookingExists => 'Vous avez déjà une réservation en attente de paiement pour ce logement : finalisez-la ou annulez-la d\'abord.',
            self::TooManyPendingBookings => 'Vous avez déjà deux réservations en attente de paiement : finalisez-en une ou annulez-en une d\'abord.',
        };
    }
}

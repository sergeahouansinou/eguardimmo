<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case ListingNotFound = 'listing_not_found';
    case ListingIncomplete = 'listing_incomplete';
    case ListingStaleVersion = 'listing_stale_version';
    case ListingArchived = 'listing_archived';
    case ListingCityInvalid = 'listing_city_invalid';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::ListingNotFound => 404,
            self::ListingIncomplete, self::ListingCityInvalid => 422,
            self::ListingStaleVersion, self::ListingArchived => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::ListingNotFound => 'Annonce introuvable',
            self::ListingIncomplete => 'Annonce incomplète',
            self::ListingStaleVersion => 'Modifiée entre-temps',
            self::ListingArchived => 'Annonce archivée',
            self::ListingCityInvalid => 'Ville inconnue',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::ListingNotFound => 'Cette annonce n\'existe pas ou n\'est pas disponible.',
            self::ListingIncomplete => 'Pour publier, renseignez le titre, le prix, la ville et la capacité d\'accueil.',
            self::ListingStaleVersion => 'L\'annonce a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.',
            self::ListingArchived => 'Une annonce archivée ne se modifie plus : republiez-la d\'abord.',
            self::ListingCityInvalid => 'La ville indiquée n\'existe pas dans le référentiel.',
        };
    }
}

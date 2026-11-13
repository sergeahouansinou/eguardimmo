<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum IntendedProfile: string
{
    case IndividualLandlord = 'individual_landlord';
    case Agency = 'agency';
    case Traveler = 'traveler';
}

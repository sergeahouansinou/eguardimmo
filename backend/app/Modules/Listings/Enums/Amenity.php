<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum Amenity: string
{
    case Wifi = 'wifi';
    case Kitchen = 'kitchen';
    case Washer = 'washer';
    case Dishwasher = 'dishwasher';
    case AirConditioning = 'air_conditioning';
    case Heating = 'heating';
    case Parking = 'parking';
    case Elevator = 'elevator';
    case Balcony = 'balcony';
    case Terrace = 'terrace';
    case Garden = 'garden';
    case Pool = 'pool';
    case Tv = 'tv';
    case Workspace = 'workspace';
    case PetsAllowed = 'pets_allowed';
    case StepFreeAccess = 'step_free_access';
}

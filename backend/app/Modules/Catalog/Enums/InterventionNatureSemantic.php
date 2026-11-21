<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

enum InterventionNatureSemantic: string
{
    case Plumbing = 'plumbing';
    case Electrical = 'electrical';
    case Heating = 'heating';
    case Locksmith = 'locksmith';
    case Humidity = 'humidity';
    case Pests = 'pests';
    case Other = 'other';
}

<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Enums;

enum InspectionPerformer: string
{
    case Parties = 'parties';
    case Agent = 'agent';
    case Bailiff = 'bailiff';
}

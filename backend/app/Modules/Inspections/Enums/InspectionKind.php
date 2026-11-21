<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Enums;

enum InspectionKind: string
{
    case Entry = 'entry';
    case Exit = 'exit';
}

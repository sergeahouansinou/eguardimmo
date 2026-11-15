<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum OrganizationKind: string
{
    case Agency = 'agency';
    case Individual = 'individual';
}

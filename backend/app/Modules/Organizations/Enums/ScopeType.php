<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Enums;

enum ScopeType: string
{
    case All = 'all';
    case Selected = 'selected';
}

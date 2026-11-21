<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Enums;

enum HoldKind: string
{
    case Full = 'full';
    case Reserve = 'reserve';
}

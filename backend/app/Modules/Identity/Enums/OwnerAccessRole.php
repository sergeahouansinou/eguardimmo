<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

enum OwnerAccessRole: string
{
    case Holder = 'holder';
    case Representative = 'representative';
    case CoOwner = 'co_owner';
}

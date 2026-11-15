<?php

declare(strict_types=1);

namespace App\Modules\Properties\Enums;

enum OwnershipNature: string
{
    case Full = 'full';
    case Bare = 'bare';
    case Usufruct = 'usufruct';
}

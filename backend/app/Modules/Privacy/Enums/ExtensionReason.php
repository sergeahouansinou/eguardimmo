<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

enum ExtensionReason: string
{
    case Complexity = 'complexity';
    case Volume = 'volume';
}

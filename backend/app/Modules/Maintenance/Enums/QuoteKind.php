<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Enums;

enum QuoteKind: string
{
    case Initial = 'initial';
    case Supplement = 'supplement';
}

<?php

declare(strict_types=1);

namespace App\Modules\Tax\Enums;

enum SummaryStatus: string
{
    case Final = 'final';
    case Published = 'published';
    case Superseded = 'superseded';
}

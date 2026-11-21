<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Enums;

enum TermChangeReason: string
{
    case Initial = 'initial';
    case Amendment = 'amendment';
}
